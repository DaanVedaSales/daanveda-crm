import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/deals/comments?deal_id=xxx — fetch comments for a deal (reverse chronological)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const deal_id = searchParams.get('deal_id')
  if (!deal_id) return NextResponse.json({ error: 'deal_id required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('deal_comments')
    .select('id, comment, deal_stage, created_at, user:users!deal_comments_user_id_fkey(id, name)')
    .eq('deal_id', deal_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/deals/comments — add a comment to a deal
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['closer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { deal_id, comment, deal_stage } = body

  if (!deal_id) return NextResponse.json({ error: 'deal_id required' }, { status: 400 })
  if (!comment?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  if (comment.trim().length > 1000) return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 })
  if (!deal_stage) return NextResponse.json({ error: 'deal_stage required' }, { status: 400 })

  const { data, error } = await supabase
    .from('deal_comments')
    .insert({
      deal_id,
      user_id: profile.id,
      comment: comment.trim(),
      deal_stage,
    })
    .select('id, comment, deal_stage, created_at, user:users!deal_comments_user_id_fkey(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
