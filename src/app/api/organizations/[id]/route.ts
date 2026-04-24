import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Helper: verify caller is admin
async function requireAdmin() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: profile } = await authClient
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Forbidden: admin access required', status: 403 }
  }
  return { error: null, status: 200 }
}

// DELETE /api/organizations/[id]
// Permanently removes an org and all related data from the system.
// Deletion order: activities → demos → deals → leads → contacts → organization
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const orgId = params.id
  if (!orgId) return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })

  const supabase = createServiceClient()

  // 1. Get all lead IDs for this org (needed to cascade activities/demos/deals)
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id')
    .eq('org_id', orgId)

  if (leadsErr) return NextResponse.json({ error: leadsErr.message }, { status: 500 })

  const leadIds = (leads ?? []).map(l => l.id)

  if (leadIds.length > 0) {
    // 2. Delete activities tied to these leads
    const { error: actErr } = await supabase
      .from('activities')
      .delete()
      .in('lead_id', leadIds)
    if (actErr) return NextResponse.json({ error: `activities: ${actErr.message}` }, { status: 500 })

    // 3. Delete demos tied to these leads
    const { error: demoErr } = await supabase
      .from('demos')
      .delete()
      .in('lead_id', leadIds)
    if (demoErr) return NextResponse.json({ error: `demos: ${demoErr.message}` }, { status: 500 })

    // 4. Delete deals tied to these leads
    const { error: dealErr } = await supabase
      .from('deals')
      .delete()
      .in('lead_id', leadIds)
    if (dealErr) return NextResponse.json({ error: `deals: ${dealErr.message}` }, { status: 500 })

    // 5. Delete leads
    const { error: leadDelErr } = await supabase
      .from('leads')
      .delete()
      .eq('org_id', orgId)
    if (leadDelErr) return NextResponse.json({ error: `leads: ${leadDelErr.message}` }, { status: 500 })
  }

  // 6. Delete contacts
  const { error: contactErr } = await supabase
    .from('contacts')
    .delete()
    .eq('org_id', orgId)
  if (contactErr) return NextResponse.json({ error: `contacts: ${contactErr.message}` }, { status: 500 })

  // 7. Delete the organization itself
  const { error: orgErr } = await supabase
    .from('organizations')
    .delete()
    .eq('id', orgId)
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
