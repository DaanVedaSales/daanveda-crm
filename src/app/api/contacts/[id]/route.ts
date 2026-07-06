import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canModifyOrgContacts } from '@/lib/contactsAccess'

// PATCH /api/contacts/[id] — update contact fields (SDR, admin, or closer)
// Uses service client for DB op since contacts table has no UPDATE RLS policy for closers
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient.from('users').select('id, role').eq('auth_id', user.id).single()
  if (!profile || !['sdr', 'admin', 'closer'].includes(profile.role)) {
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

  // Use service client to bypass RLS (contacts UPDATE policy only covers sdr/admin via RLS)
  const supabase = createServiceClient()

  // Ownership: caller must be working this contact's org (admin bypasses).
  const { data: contactRow } = await supabase.from('contacts').select('org_id').eq('id', params.id).single()
  if (!contactRow) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  if (!(await canModifyOrgContacts(supabase, (profile as any).id, (profile as any).role, (contactRow as any).org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
