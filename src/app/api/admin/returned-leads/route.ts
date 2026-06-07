import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/returned-leads — leads returned to admin (phase='dead'), admin only.
// Grouped client-side by returned_reason: not_interested | dead | ban_requested.
export async function GET() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient
    .from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id, status, returned_reason, updated_at, org_id, assigned_to,
      organization:organizations(id, name, location, is_banned),
      assignee:users!leads_assigned_to_fkey(id, name)
    `)
    .eq('phase', 'dead')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = (leads ?? []).filter((l: any) => !l.organization?.is_banned)

  // Attach the distinct channels tried (from activity history) for each lead
  const ids = list.map((l: any) => l.id)
  const methodsByLead: Record<string, string[]> = {}
  if (ids.length > 0) {
    const { data: acts } = await supabase
      .from('activities')
      .select('lead_id, channel')
      .in('lead_id', ids)
    ;(acts ?? []).forEach((a: any) => {
      if (!a.channel) return
      if (!methodsByLead[a.lead_id]) methodsByLead[a.lead_id] = []
      if (!methodsByLead[a.lead_id].includes(a.channel)) methodsByLead[a.lead_id].push(a.channel)
    })
  }

  return NextResponse.json(list.map((l: any) => ({ ...l, methods: methodsByLead[l.id] ?? [] })))
}
