import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/contacts/[id] — update contact fields (SDR or admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || !['sdr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { name, designation, phone, email, linkedin_url } = body

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined)         updatePayload.name = name
  if (designation !== undefined)  updatePayload.designation = designation
  if (phone !== undefined)        updatePayload.phone = phone
  if (email !== undefined)        updatePayload.email = email
  if (linkedin_url !== undefined) updatePayload.linkedin_url = linkedin_url

  const { data, error } = await supabase
    .from('contacts')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
