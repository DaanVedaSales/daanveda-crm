import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/leads/bulk-delete — HARD delete a set of selected leads (admin only).
// Body: { lead_ids: string[] }. Removes the leads + cascaded activities/demos/deals
// + orphaned non-banned orgs/contacts (via leads_purge()).
export async function POST(req: NextRequest) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await authClient.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const { lead_ids } = await req.json()
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return NextResponse.json({ error: 'lead_ids array is required' }, { status: 400 })
  }

  const supabase = createServiceClient() as any  // rpc() to custom function not in generated types
  const { data, error } = await supabase.rpc('leads_purge', { p_lead_ids: lead_ids })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json(row ?? { leads_deleted: 0, orgs_deleted: 0 })
}
