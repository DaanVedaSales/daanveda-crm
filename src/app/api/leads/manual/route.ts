import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads/manual — SDR manually enters a new lead (org + KDM contact + lead)
// Creates everything in one atomic flow and returns it into the SDR's Assigned Leads
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['sdr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: SDR or admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_name,
    location,
    org_url,
    org_linkedin,
    thematic_areas,
    kdm_name,
    kdm_phone,
    kdm_designation,
    kdm_email,
    kdm_linkedin,
    kdm2_name,
    kdm2_phone,
    kdm2_designation,
    kdm2_email,
    kdm2_linkedin,
    kdm3_name,
    kdm3_phone,
    kdm3_designation,
    kdm3_email,
    kdm3_linkedin,
    notes, // stored in activity log, not in leads table (leads has no notes column)
  } = body

  if (!org_name?.trim()) {
    return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 })
  }
  if (!kdm_name?.trim()) {
    return NextResponse.json({ error: 'KDM (key decision maker) name is required' }, { status: 400 })
  }

  // Parse thematic_areas — may be array or comma-separated string
  let thematicArr: string[] = []
  if (Array.isArray(thematic_areas)) thematicArr = thematic_areas.filter(Boolean)
  else if (typeof thematic_areas === 'string' && thematic_areas.trim()) {
    thematicArr = thematic_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
  }

  // 1. Create organisation
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name: org_name.trim(),
      location: location?.trim() || null,
      url: org_url?.trim() || null,
      linkedin_url: org_linkedin?.trim() || null,
      thematic_areas: thematicArr.length > 0 ? thematicArr : null,
    })
    .select('id')
    .single()

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 })

  // 2. Create primary KDM contact
  const { error: contactErr } = await supabase
    .from('contacts')
    .insert({
      org_id: org.id,
      name: kdm_name.trim(),
      phone: kdm_phone?.trim() || null,
      designation: kdm_designation?.trim() || null,
      email: kdm_email?.trim() || null,
      linkedin_url: kdm_linkedin?.trim() || null,
      is_primary: true,
    })

  if (contactErr) {
    // Best-effort — don't fail the whole flow for contact creation
    console.error('Contact creation failed:', contactErr.message)
  }

  // 2b. Create KDM2 if provided
  if (kdm2_name?.trim()) {
    const { error: contact2Err } = await supabase
      .from('contacts')
      .insert({
        org_id: org.id,
        name: kdm2_name.trim(),
        phone: kdm2_phone?.trim() || null,
        designation: kdm2_designation?.trim() || null,
        email: kdm2_email?.trim() || null,
        linkedin_url: kdm2_linkedin?.trim() || null,
        is_primary: false,
      })
    if (contact2Err) console.error('KDM2 contact creation failed:', contact2Err.message)
  }

  // 2c. Create KDM3 if provided
  if (kdm3_name?.trim()) {
    const { error: contact3Err } = await supabase
      .from('contacts')
      .insert({
        org_id: org.id,
        name: kdm3_name.trim(),
        phone: kdm3_phone?.trim() || null,
        designation: kdm3_designation?.trim() || null,
        email: kdm3_email?.trim() || null,
        linkedin_url: kdm3_linkedin?.trim() || null,
        is_primary: false,
      })
    if (contact3Err) console.error('KDM3 contact creation failed:', contact3Err.message)
  }

  // 3. Create lead assigned to the SDR
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      org_id: org.id,
      status: 'new',
      phase: 'sdr',
      assigned_to: profile.id,
    })
    .select()
    .single()

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })

  // 4. Log activity — include SDR's notes here since leads table has no notes column
  const activityNote = [
    `Lead manually entered by SDR. KDM: ${kdm_name.trim()}${kdm_phone ? ` · ${kdm_phone}` : ''}`,
    notes?.trim() ? `SDR note: ${notes.trim()}` : null,
  ].filter(Boolean).join(' — ')

  await supabase.from('activities').insert({
    lead_id: lead.id,
    org_id: org.id,
    user_id: profile.id,
    activity_type: 'note',
    notes: activityNote,
    new_value: 'manual_entry',
  })

  return NextResponse.json({ lead, org }, { status: 201 })
}
