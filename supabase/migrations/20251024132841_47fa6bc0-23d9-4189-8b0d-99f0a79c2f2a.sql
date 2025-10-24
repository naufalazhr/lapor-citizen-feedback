-- Make geo_location nullable in reports table
ALTER TABLE public.reports 
ALTER COLUMN geo_location DROP NOT NULL;