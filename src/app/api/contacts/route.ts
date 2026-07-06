import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canModifyOrgContacts } from '@/lib/contactsAccess'

// POST /api/contacts — create a new contact for an org (SDR, admin, or closer)
export async function POST(req: NextRequest) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient.from('users').select('id, role').eq('auth_id', user.id).single()
  if (!profile || !['sdr', 'admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { org_id, name, designation, phone, email, linkedin_url, is_primary } = body

  if (!org_id || !name?.trim()) {
    return NextResponse.json({ error: 'org_id and name are required' }, { status: 400 })
  }

  // Use service client so the INSERT works regardless of RLS INSERT policy
  const supabase = createServiceClient()

  // Ownership: caller must be working this org (admin bypasses).
  if (!(await canModifyOrgContacts(supabase, (profile as any).id, (profile as any).role, org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      org_id,
      name: name.trim(),
      designation: designation?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      linkedin_url: linkedin_url?.trim() || null,
      is_primary: is_primary ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
