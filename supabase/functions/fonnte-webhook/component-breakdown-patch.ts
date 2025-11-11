// ============================================================================
// PATCH: Add this code to index-instrumented.ts
// Replace the webhook_total logging section (around line 398-410)
// ============================================================================

    // ============================================================================
    // Calculate Component Breakdown for Simplified Monitoring
    // ============================================================================
    const dbDuration = (
      (perfMetrics.db_find_conversation || 0) +
      (perfMetrics.db_get_index || 0) +
      (perfMetrics.db_get_history || 0) +
      (perfMetrics.db_save_user_message || 0) +
      (perfMetrics.db_save_assistant_message || 0) +
      (perfMetrics.db_update_session || 0)
    );
    const flowiseDuration = perfMetrics.flowise_api || 0;
    const fonnteDuration = perfMetrics.fonnte_send || 0;
    const attachmentDuration = perfMetrics.attachment_processing || 0;
    const otherDuration = totalDuration - dbDuration - flowiseDuration - fonnteDuration - attachmentDuration;

    // Log webhook_total metric with component breakdown
    await logPerformanceMetrics(
      tenantId,
      conversationId,
      'webhook_total',
      totalDuration,
      {
        has_attachment: normalized.hasAttachment,
        message_length: messageContent.length,
        history_count: historyForFlowise.length,
        flowise_attempts: perfMetrics.flowise_attempts || 1,
        // ========================================================================
        // COMPONENT BREAKDOWN - For simplified per-service monitoring
        // ========================================================================
        components: {
          flowise: Math.round(flowiseDuration),
          database: Math.round(dbDuration),
          fonnte_send: Math.round(fonnteDuration),
          attachment: Math.round(attachmentDuration),
          other: Math.round(Math.max(0, otherDuration))
        },
        breakdown_pct: {
          flowise: parseFloat(((flowiseDuration / totalDuration) * 100).toFixed(1)),
          database: parseFloat(((dbDuration / totalDuration) * 100).toFixed(1)),
          fonnte_send: parseFloat(((fonnteDuration / totalDuration) * 100).toFixed(1)),
          attachment: parseFloat(((attachmentDuration / totalDuration) * 100).toFixed(1)),
          other: parseFloat(((Math.max(0, otherDuration) / totalDuration) * 100).toFixed(1))
        }
      }
    );

// ============================================================================
// INSTALLATION INSTRUCTIONS:
// ============================================================================
// 1. Open: fonnte-webhook/index-instrumented.ts
// 2. Find the section that logs webhook_total metric (around line 398-410)
// 3. Replace that section with the code above
// 4. Save and deploy: supabase functions deploy fonnte-webhook
// ============================================================================
