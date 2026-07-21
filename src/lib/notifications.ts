import { createServiceClient } from '@/lib/supabase/server'

// In-app notification helper.
//
// DESIGN RULE: these functions are BEST-EFFORT and MUST NEVER THROW. A failure to
// write a notification can never break the core action that triggered it (booking a
// demo, assigning a lead, etc.). Every path is wrapped in try/catch and swallows errors
// (logged only). Callers should `await` them (so the insert completes before a serverless
// function returns) but never depend on their result.
//
// Inserts use the SERVICE client on purpose: a notification is written for ANOTHER user
// (the recipient), which RLS would block for the acting user. The service role bypasses RLS.

export type NotifyInput = {
  userId: string                 // recipient (users.id)
  actorId?: string | null        // who caused it (display only)
  type: string
  title: string
  body?: string | null
  link?: string | null           // in-app path to deep-link to the record
}

function toRow(i: NotifyInput) {
  return {
    user_id: i.userId,
    actor_id: i.actorId ?? null,
    type: i.type,
    title: i.title,
    body: i.body ?? null,
    link: i.link ?? null,
  }
}

// Never notify a user about their own action.
function keep(i: NotifyInput): boolean {
  return !!i.userId && !(i.actorId != null && i.actorId === i.userId)
}

/** Notify a single user. Silent no-op on any failure. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (!keep(input)) return
    const supabase = createServiceClient() as any
    await supabase.from('notifications').insert(toRow(input))
  } catch (e) {
    console.error('notify failed (non-blocking):', e)
  }
}

/** Notify several users in one insert. Silent no-op on any failure. */
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  try {
    const rows = inputs.filter(keep).map(toRow)
    if (rows.length === 0) return
    const supabase = createServiceClient() as any
    await supabase.from('notifications').insert(rows)
  } catch (e) {
    console.error('notifyMany failed (non-blocking):', e)
  }
}

/** Notify every active user of a given role (e.g. all admins). Silent no-op on any failure. */
export async function notifyRole(
  role: 'admin' | 'sdr' | 'closer',
  input: Omit<NotifyInput, 'userId'>,
): Promise<void> {
  try {
    const supabase = createServiceClient() as any
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role', role)
      .eq('is_active', true)
    if (!users?.length) return
    await notifyMany(
      (users as { id: string }[]).map((u) => ({ ...input, userId: u.id })),
    )
  } catch (e) {
    console.error('notifyRole failed (non-blocking):', e)
  }
}
