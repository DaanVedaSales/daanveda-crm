import { createServiceClient } from '@/lib/supabase/server'

// Reusable daily-maintenance helpers, run from the app's daily cron.
// BEST-EFFORT: every function is wrapped and never throws, so housekeeping can never
// break the cron that triggers it. Future daily jobs (converting-later reminders,
// email digests) can be added here as sibling functions.

export const NOTIFICATION_RETENTION_DAYS = 30

// Delete notifications older than the retention window (read AND unread).
// The notifications table has no child foreign keys, so this touches nothing else.
export async function cleanupOldNotifications(days = NOTIFICATION_RETENTION_DAYS): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const supabase = createServiceClient() as any
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoff)
      .select('id')
    if (error) {
      console.error('cleanupOldNotifications error (non-blocking):', error.message)
      return 0
    }
    return Array.isArray(data) ? data.length : 0
  } catch (e) {
    console.error('cleanupOldNotifications failed (non-blocking):', e)
    return 0
  }
}
