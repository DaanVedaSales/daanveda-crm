import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toISTDateString } from '@/lib/utils'
import { notify } from '@/lib/notifications'

// POST /api/demos — book demo + handoff (SDR only)
// closer_id is optional — if provided, assigns that closer; otherwise round-robin
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sdrProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!sdrProfile) return NextResponse.json({ error: 'User not found' }, { status: 401 })
  if (sdrProfile.role !== 'sdr') {
    return NextResponse.json({ error: 'Forbidden: only SDRs can book demos' }, { status: 403 })
  }

  const body = await req.json()
  const {
    lead_id, org_id, demo_date,
    pain_point, demo_expectation, sdr_summary,
    sdr_interest_signal, closer_id: requestedCloserId,
  } = body

  // pain_point is the new required structured field
  if (!pain_point || String(pain_point).trim().length < 5) {
    return NextResponse.json(
      { error: 'Pain point is required (min 5 characters).' },
      { status: 400 }
    )
  }

  if (!demo_expectation || String(demo_expectation).trim().length < 5) {
    return NextResponse.json(
      { error: 'Demo expectation is required (min 5 characters).' },
      { status: 400 }
    )
  }

  if (!lead_id || !org_id || !demo_date) {
    return NextResponse.json({ error: 'lead_id, org_id, and demo_date are required' }, { status: 400 })
  }

  // Prevent duplicate booking — if lead is already demo_booked, block it
  const { data: existingLead } = await supabase.from('leads').select('status').eq('id', lead_id).single()
  if (existingLead?.status === 'demo_booked') {
    return NextResponse.json(
      { error: 'A demo is already booked for this lead. Only one active demo per lead is allowed.' },
      { status: 409 }
    )
  }

  const demoDateObj = new Date(demo_date)
  if (isNaN(demoDateObj.getTime())) {
    return NextResponse.json({ error: 'Invalid demo_date format' }, { status: 400 })
  }

  // Determine closer assignment
  let assignedCloserId: string

  if (requestedCloserId) {
    // Validate the chosen closer is real and active
    const { data: chosenCloser } = await supabase
      .from('users')
      .select('id')
      .eq('id', requestedCloserId)
      .eq('role', 'closer')
      .eq('is_active', true)
      .single()

    if (!chosenCloser) {
      return NextResponse.json({ error: 'Selected closer is not available.' }, { status: 400 })
    }
    assignedCloserId = chosenCloser.id
  } else {
    // Round-robin fallback: assign to closer with fewest active demos
    const { data: closers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'closer')
      .eq('is_active', true)

    if (!closers || closers.length === 0) {
      return NextResponse.json({ error: 'No active closers available for assignment.' }, { status: 400 })
    }

    const closerDemoCounts = await Promise.all(
      closers.map(async (c) => {
        const { count } = await supabase
          .from('demos')
          .select('id', { count: 'exact', head: true })
          .eq('closer_id', c.id)
          .in('status', ['scheduled', 'rescheduled'])
        return { id: c.id, count: count ?? 0 }
      })
    )
    closerDemoCounts.sort((a, b) => a.count - b.count)
    assignedCloserId = closerDemoCounts[0].id
  }

  // 1. Create demo record (sdr_id is IMMUTABLE — SDR attribution for bonus tracking)
  const { data: demo, error: demoError } = await supabase
    .from('demos')
    .insert({
      lead_id,
      org_id,
      sdr_id: sdrProfile.id,
      closer_id: assignedCloserId,
      demo_date,
      pain_point: String(pain_point).trim(),
      demo_expectation: String(demo_expectation).trim(),
      sdr_summary: sdr_summary ? String(sdr_summary).trim() : null,
      sdr_interest_signal,
      status: 'scheduled',
    })
    .select()
    .single()

  if (demoError) return NextResponse.json({ error: demoError.message }, { status: 500 })

  // 2. Create deal record — starts at demo_scheduled until closer marks demo as attended
  const { error: dealError } = await supabase
    .from('deals')
    .insert({
      demo_id: demo.id,
      lead_id,
      org_id,
      closer_id: assignedCloserId,
      stage: 'demo_scheduled',
      first_demo_date: toISTDateString(new Date(demo_date)),
    })

  if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })

  // 3. Update lead: handoff to closer workspace
  // Must use service client — SDR's RLS policy (sdr_update_leads) only covers
  // phase='sdr' leads; this update changes phase to 'closer' and reassigns,
  // so it needs the service role to bypass RLS.
  const serviceSupabase = createServiceClient()
  const { error: leadHandoffError } = await serviceSupabase
    .from('leads')
    .update({
      status: 'demo_booked',
      phase: 'closer',
      assigned_to: assignedCloserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead_id)

  if (leadHandoffError) return NextResponse.json({ error: leadHandoffError.message }, { status: 500 })

  // 4. Log activity
  await supabase.from('activities').insert({
    lead_id,
    org_id,
    user_id: sdrProfile.id,
    activity_type: 'demo_booked',
    notes: `Demo booked for ${demo_date}. Pain point: ${String(pain_point).slice(0, 80)}`,
    new_value: 'demo_booked',
  })

  // 5. Log lead assignment
  await supabase.from('lead_assignments').insert({
    lead_id,
    from_user_id: sdrProfile.id,
    to_user_id: assignedCloserId,
    assigned_by: sdrProfile.id,
    reason: 'Demo booked — assigned to Closer',
  })

  // 6. Notify the assigned closer (best-effort — never blocks booking)
  const { data: bookOrg } = await supabase.from('organizations').select('name').eq('id', org_id).single()
  const { data: bookSdr } = await supabase.from('users').select('name').eq('id', sdrProfile.id).single()
  await notify({
    userId: assignedCloserId,
    actorId: sdrProfile.id,
    type: 'demo_booked',
    title: 'New demo booked for you',
    body: `${bookSdr?.name ?? 'An SDR'} booked a demo${bookOrg?.name ? ` with ${bookOrg.name}` : ''}.`,
    link: '/closer/today',
  })

  return NextResponse.json(
    { demo, message: 'Demo booked and lead handed off to Closer.' },
    { status: 201 }
  )
}
