-- Function to safely return a report to member by OPD member
create or replace function public.opd_return_report(p_report_id uuid, p_notes text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assigned_opd uuid;
  v_tenant_id uuid;
  v_status text;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  -- must be OPD member
  if not has_role(v_user_id, 'opd_member') then
    return jsonb_build_object('success', false, 'error', 'not_opd_member');
  end if;

  -- lock the report row and fetch current values
  select r.assigned_opd_id, r.status, coalesce(r.tenant_id, get_user_tenant_id(v_user_id))
    into v_assigned_opd, v_status, v_tenant_id
  from public.reports r
  where r.id = p_report_id
  for update;

  if v_assigned_opd is null then
    return jsonb_build_object('success', false, 'error', 'report_not_assigned');
  end if;

  -- ensure the OPD member is assigned to this OPD
  if not exists (
    select 1 from public.user_opd_assignments uoa
    where uoa.user_id = v_user_id and uoa.opd_id = v_assigned_opd and uoa.is_active = true
  ) then
    return jsonb_build_object('success', false, 'error', 'not_assigned_to_opd');
  end if;

  -- clear assignment
  update public.reports
  set assigned_opd_id = null,
      updated_at = now()
  where id = p_report_id;

  -- write disposition
  insert into public.report_dispositions (
    report_id, opd_id, previous_opd_id, assigned_by, notes,
    status_before, status_after, action_type, tenant_id
  ) values (
    p_report_id, v_assigned_opd, v_assigned_opd, v_user_id, p_notes,
    v_status, v_status, 'return_to_member', v_tenant_id
  );

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.opd_return_report(uuid, text) to authenticated;