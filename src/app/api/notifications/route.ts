import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications — the signed-in user's own notifications + unread count.
// RLS (notifications_select_own) guarantees a user only ever sees their own rows.
export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  const { data: items, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count: unread } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return NextResponse.json({ items: items ?? [], unread: unread ?? 0 })
}
