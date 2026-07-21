import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/notifications/read — mark one ({ id }) or all ({ all: true }) as read.
// RLS (notifications_update_own) scopes every update to the caller's own rows, so a user
// can never mark someone else's notification read even without an explicit user filter.
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 401 })

  const { id, all } = await req.json().catch(() => ({}))

  // `notifications` isn't in the (stale) generated types yet → cast, matching the
  // repo's convention for untyped-client access.
  let query = (supabase as any)
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })

  if (all) {
    query = query.eq('is_read', false)
  } else if (id) {
    query = query.eq('id', id)
  } else {
    return NextResponse.json({ error: 'Provide id or all:true' }, { status: 400 })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
