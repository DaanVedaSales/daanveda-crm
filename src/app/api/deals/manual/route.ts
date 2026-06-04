import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/deals/manual — Closer manually enters a new deal
// Creates: org + KDM contact + lead (phase=closer) + optional demo + deal
// The deal flows straight into the Closer's pipeline Kanban.
//
// Body params:
//   org_name         (required)
//   location         (optional)
//   kdm_name         (required)
//   kdm_phone        (optional)
//   kdm_designation  (optional)
//   deal_value       (optional number)
//   demo_status      'scheduled' | 'done' | 'tbd'  (required)
//   demo_date        ISO string — required when demo_status = 'scheduled'
//   sdr_summary      string — context note for the deal card (optional)
//   notes            string — general notes (optional)

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['closer', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: Closer or admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_name,
    location,
    kdm_name,
    kdm_phone,
    kdm_designation,
    deal_value,
    demo_status, // 'scheduled' | 'done' | 'tbd'
    demo_date,
    sdr_summary,
    notes,
  } = body

  if (!org_name?.trim()) {
    return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 })
  }
  if (!kdm_name?.trim()) {
    return NextResponse.json({ error: 'KDM name is required' }, { status: 400 })
  }
  if (!['scheduled', 'done', 'tbd'].includes(demo_status)) {
    return NextResponse.json({ error: 'demo_status must be scheduled, done, or tbd' }, { status: 400 })
  }
  if (demo_status === 'scheduled' && !demo_date) {
    return NextResponse.json({ error: 'demo_date is required when demo_status is scheduled' }, { status: 400 })
  }

  // Block adding a deal for a banned organisation (do-not-contact)
  const { data: bannedMatch } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', org_name.trim())
    .eq('is_banned', true)
    .limit(1)
  if (bannedMatch && bannedMatch.length > 0) {
    return NextResponse.json({ error: 'This organisation is banned (do-not-contact) and cannot be added.' }, { status: 403 })
  }

  // 1. Create organisation
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: org_name.trim(),
      location: location?.trim() || null,
    })
    .select('id')
    .single()

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

  // 2. Create KDM contact (best-effort)
  await supabase.from('contacts').insert({
    org_id: org.id,
    name: kdm_name.trim(),
    phone: kdm_phone?.trim() || null,
    designation: kdm_designation?.trim() || null,
    is_primary: true,
  })

  // 3. Create lead (phase=closer since closer is entering it directly)
  // Note: leads table has no notes column — context goes into sdr_summary on the demo record
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      org_id: org.id,
      status: 'demo_booked', // treat as already handed off to closer
      phase: 'closer',
      assigned_to: profile.id,
    })
    .select('id')
    .single()

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })

  // 4. Determine deal stage based on demo_status
  let dealStage: string
  if (demo_status === 'done') {
    dealStage = 'demo_done'
  } else if (demo_status === 'scheduled') {
    dealStage = 'demo_scheduled'
  } else {
    dealStage = 'demo_scheduled' // TBD — closer to push forward manually
  }

  // 5. Create demo record (always — ties the org to a demo touchpoint)
  let demoId: string | null = null
  const demoDateValue = demo_status === 'scheduled' ? demo_date
    : demo_status === 'done' ? new Date().toISOString() // approximate
    : new Date(Date.now() + 7 * 86400000).toISOString() // TBD → 7 days from now as placeholder

  const { data: demo, error: demoErr } = await supabase
    .from('demos')
    .insert({
      lead_id: lead.id,
      org_id: org.id,
      closer_id: profile.id,
      demo_date: demoDateValue,
      status: demo_status === 'done' ? 'attended' : 'scheduled',
      sdr_summary: sdr_summary?.trim() || `Manual entry by ${profile.id}. No SDR context.`,
    })
    .select('id')
    .single()

  if (!demoErr) demoId = demo.id

  // 6. Create deal in the pipeline
  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .insert({
      org_id: org.id,
      lead_id: lead.id,
      demo_id: demoId,
      closer_id: profile.id,
      stage: dealStage,
      deal_value: deal_value ? parseInt(deal_value) : null,
    })
    .select('id')
    .single()

  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 })

  // 7. Log activity
  await supabase.from('activities').insert({
    lead_id: lead.id,
    org_id: org.id,
    user_id: profile.id,
    activity_type: 'note',
    notes: `Deal manually entered by Closer. Demo status: ${demo_status}. KDM: ${kdm_name.trim()}${kdm_phone ? ` · ${kdm_phone}` : ''}`,
    new_value: 'manual_entry',
  })

  return NextResponse.json({ deal, lead, org }, { status: 201 })
}
