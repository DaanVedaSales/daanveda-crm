import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canModifyOrgContacts } from '@/lib/contactsAccess'

// POST /api/contacts/[id]/set-primary — make this contact the primary KDM for its org.
// Unsets is_primary on every other contact of the same org so exactly one stays primary.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient.from('users').select('id, role').eq('auth_id', user.id).single()
  if (!profile || !['sdr', 'admin', 'closer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Find the target contact's org so we can scope the primary flip.
  const { data: target, error: findErr } = await supabase
    .from('contacts')
    .select('id, org_id')
    .eq('id', params.id)
    .single()
  if (findErr || !target) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Ownership: caller must be working this contact's org (admin bypasses).
  if (!(await canModifyOrgContacts(supabase, (profile as any).id, (profile as any).role, (target as any).org_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()

  // Demote every other contact on the org, then promote this one.
  const { error: demoteErr } = await supabase
    .from('contacts')
    .update({ is_primary: false, updated_at: now })
    .eq('org_id', target.org_id)
    .neq('id', target.id)
  if (demoteErr) return NextResponse.json({ error: demoteErr.message }, { status: 500 })

  const { data, error: promoteErr } = await supabase
    .from('contacts')
    .update({ is_primary: true, updated_at: now })
    .eq('id', target.id)
    .select()
    .single()
  if (promoteErr) return NextResponse.json({ error: promoteErr.message }, { status: 500 })

  return NextResponse.json(data)
}
