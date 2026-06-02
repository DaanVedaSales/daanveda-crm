import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toISTDateString } from '@/lib/utils'

// GET /api/admin/export — download full lead log as CSV (admin only)
export async function GET(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  // Fetch all leads with org, demo (if any), deal (if any), assigned user
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      status,
      phase,
      created_at,
      updated_at,
      follow_up_date,
      organization:organizations(
        name, url, location, annual_revenue, team_size,
        age_years, thematic_areas, linkedin_url, sql_score, sql_score_label
      ),
      assigned_user:users!leads_assigned_to_fkey(name, role),
      demos(
        id, demo_date, status, sdr_summary, reminder_sent, created_at,
        sdr:users!demos_sdr_id_fkey(name),
        closer:users!demos_closer_id_fkey(name)
      ),
      deals(
        id, stage, deal_value, date_won_lost, loss_reason,
        invoice_status, created_at
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build CSV rows
  const header = [
    'Lead ID', 'Org Name', 'Website', 'Location', 'Annual Revenue',
    'Team Size', 'Age (Years)', 'Thematic Areas', 'LinkedIn', 'SQL Score',
    'Lead Status', 'Phase', 'Assigned To (Role)',
    'Demo Date', 'Demo Status', 'Demo Booked At', 'SDR Name', 'Closer Name',
    'SDR Summary (first 200 chars)', 'Reminder Sent',
    'Deal Stage', 'Deal Value', 'Date Won/Lost', 'Loss Reason', 'Invoice Status',
    'Lead Created At', 'Lead Last Updated',
  ]

  const escape = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = (leads ?? []).map((l: any) => {
    const org = l.organization ?? {}
    const demo = l.demos?.[0] ?? null  // most recent demo
    const deal = l.deals?.[0] ?? null  // most recent deal
    const assignedUser = l.assigned_user

    return [
      l.id,
      org.name,
      org.url,
      org.location,
      org.annual_revenue,
      org.team_size,
      org.age_years,
      Array.isArray(org.thematic_areas) ? org.thematic_areas.join('; ') : org.thematic_areas,
      org.linkedin_url,
      org.sql_score_label ?? org.sql_score,
      l.status,
      l.phase,
      assignedUser ? `${assignedUser.name} (${assignedUser.role})` : '',
      demo?.demo_date ?? '',
      demo?.status ?? '',
      demo?.created_at ?? '',
      demo?.sdr?.name ?? '',
      demo?.closer?.name ?? '',
      demo?.sdr_summary ? String(demo.sdr_summary).slice(0, 200) : '',
      demo?.reminder_sent ? 'Yes' : 'No',
      deal?.stage ?? '',
      deal?.deal_value ?? '',
      deal?.date_won_lost ?? '',
      deal?.loss_reason ?? '',
      deal?.invoice_status ?? '',
      l.created_at,
      l.updated_at,
    ].map(escape).join(',')
  })

  const csv = [header.join(','), ...rows].join('\n')
  const now = toISTDateString()   // IST calendar day for the export filename

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="daanveda-crm-export-${now}.csv"`,
    },
  })
}
