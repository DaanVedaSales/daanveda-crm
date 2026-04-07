import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/demos/:id — update demo status, post-demo notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { status, post_demo_notes, closer_id } = body

  const supabase = createClient()

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updatePayload.status = status
  if (post_demo_notes !== undefined) updatePayload.post_demo_notes = post_demo_notes
  if (closer_id !== undefined) updatePayload.closer_id = closer_id

  const { data, error } = await supabase
    .from('demos')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
