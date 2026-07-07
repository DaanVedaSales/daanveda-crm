import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/deals/comments/[id] — permanently remove a deal comment.
// AUTHOR-ONLY: a user may delete only the comments they posted (no admin bypass —
// admins have no UI that surfaces these comments). Hard delete (removed from DB).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient.from('users').select('id').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: row } = await supabase.from('deal_comments').select('user_id').eq('id', params.id).single()
  if (!row) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  // Only the person who posted it may delete it.
  if ((row as any).user_id !== (profile as any).id) {
    return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 })
  }

  const { error } = await supabase.from('deal_comments').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
