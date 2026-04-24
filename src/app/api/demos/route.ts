import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const { lead_id, org_id, demo_date, sdr_summary, sdr_interest_signal, closer_id: requestedCloserId } = body

  if (!sdr_summary || sdr_summary.trim().length < 50) {
    return NextResponse.json(
      { error: 'SDR conversation summary is mandatory and must be at least 50 characters.' },
      { status: 400 }
    )
  }

  if (!lead_id || !org_id || !demo_date) {
    return NextResponse.json({ error: 'lead_id, org_id, and demo_date are required' }, { status: 400 })
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
      sdr_summary: sdr_summary.trim(),
      sdr_interest_signal,
      status: 'scheduled',
    })
    .select()
    .single()

  if (demoError) return NextResponse.json({ error: demoError.message }, { status: 500 })

  // 2. Create deal record (starts at demo_done stage — visible in closer's pipeline)
  const { error: dealError } = await supabase
    .from('deals')
    .insert({
      demo_id: demo.id,
      lead_id,
      org_id,
      closer_id: assignedCloserId,
      stage: 'demo_done',
      first_demo_date: demo_date.split('T')[0],
    })

  if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 })

  // 3. Update lead: handoff to closer workspace
  await supabase
    .from('leads')
    .update({
      status: 'demo_booked',
      phase: 'closer',
      assigned_to: assignedCloserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead_id)

  // 4. Log activity
  await supabase.from('activities').insert({
    lead_id,
    org_id,
    user_id: sdrProfile.id,
    activity_type: 'demo_booked',
    notes: `Demo booked for ${demo_date}. Summary: ${sdr_summary.slice(0, 100)}...`,
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

  return NextResponse.json(
    { demo, message: 'Demo booked and lead handed off to Closer.' },
    { status: 201 }
  )
}
