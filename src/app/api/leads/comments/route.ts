import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET  /api/leads/comments?lead_id=xxx  — fetch comments for a lead (latest first)
// POST /api/leads/comments              — create a comment on a lead

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('lead_comments')
    .select(`
      id,
      comment,
      created_at,
      user:users!lead_comments_user_id_fkey(id, name)
    `)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only SDR and admin can post lead comments
  if (!['sdr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { lead_id, comment } = body

  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  if (!comment?.trim()) return NextResponse.json({ error: 'comment cannot be empty' }, { status: 400 })

  // SDR guard: can only comment on their own assigned leads
  if (profile.role === 'sdr') {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, assigned_to')
      .eq('id', lead_id)
      .single()

    if (!lead || lead.assigned_to !== profile.id) {
      return NextResponse.json({ error: 'You can only comment on your assigned leads' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('lead_comments')
    .insert({
      lead_id,
      user_id: profile.id,
      comment: comment.trim(),
    })
    .select(`
      id,
      comment,
      created_at,
      user:users!lead_comments_user_id_fkey(id, name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
