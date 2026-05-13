import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_ROWS_PER_UPLOAD = 5000 // DoS protection

// POST /api/datasets/upload — bulk create orgs + contacts from CSV rows (admin only)
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { dataset_id, rows } = body

  if (!dataset_id || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'dataset_id and rows array are required' }, { status: 400 })
  }

  if (rows.length > MAX_ROWS_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ROWS_PER_UPLOAD} rows per upload. Split your file into smaller batches.` },
      { status: 400 }
    )
  }

  let created = 0
  let skipped = 0
  const duplicates: string[] = []
  const errors: string[] = []

  for (const row of rows) {
    const {
      name, url, location, annual_revenue, team_size, thematic_areas,
      age_years, linkedin_url, sql_score_label,
      // KDM1
      kdm_name, kdm_phone, kdm_email, kdm_designation, kdm_linkedin,
      // KDM2
      kdm2_name, kdm2_phone, kdm2_email, kdm2_designation, kdm2_linkedin,
      // KDM3
      kdm3_name, kdm3_phone, kdm3_email, kdm3_designation, kdm3_linkedin,
    } = row

    // Org name is the only required field
    if (!name || typeof name !== 'string') { skipped++; continue }
    const cleanName = name.trim().slice(0, 255)
    if (!cleanName) { skipped++; continue }

    // Duplicate check (case-insensitive org name match)
    const { data: existing } = await supabase
      .from('organizations')
      .select('id')
      .ilike('name', cleanName)
      .limit(1)
      .single()

    if (existing) {
      duplicates.push(cleanName)
      skipped++
      continue
    }

    // Parse thematic_areas — may come as comma-separated string or array
    let thematicArr: string[] = []
    if (Array.isArray(thematic_areas)) thematicArr = thematic_areas
    else if (typeof thematic_areas === 'string' && thematic_areas.trim()) {
      thematicArr = thematic_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    // Insert organization
    // sql_score_label is stored as-is from the upload (pre-scored externally)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        dataset_id,
        name: cleanName,
        url: url ? String(url).slice(0, 500) : null,
        linkedin_url: linkedin_url ? String(linkedin_url).slice(0, 500) : null,
        location: location ? String(location).slice(0, 255) : null,
        thematic_areas: thematicArr.length > 0 ? thematicArr : null,
        annual_revenue: annual_revenue ? Number(annual_revenue) || null : null,
        team_size: team_size ? Number(team_size) || null : null,
        age_years: age_years ? Number(age_years) || null : null,
        sql_score_label: sql_score_label ? String(sql_score_label).slice(0, 50) : null,
      })
      .select()
      .single()

    if (orgError) { errors.push(`${cleanName}: ${orgError.message}`); continue }

    // Insert KDM1 (primary contact)
    if (kdm_name) {
      await supabase.from('contacts').insert({
        org_id: org.id,
        name: String(kdm_name).slice(0, 255),
        designation: kdm_designation ? String(kdm_designation).slice(0, 100) : null,
        phone: kdm_phone ? String(kdm_phone).slice(0, 20) : null,
        email: kdm_email ? String(kdm_email).slice(0, 255) : null,
        linkedin_url: kdm_linkedin ? String(kdm_linkedin).slice(0, 500) : null,
        is_primary: true,
      })
    }

    // Insert KDM2 (secondary contact)
    if (kdm2_name) {
      await supabase.from('contacts').insert({
        org_id: org.id,
        name: String(kdm2_name).slice(0, 255),
        designation: kdm2_designation ? String(kdm2_designation).slice(0, 100) : null,
        phone: kdm2_phone ? String(kdm2_phone).slice(0, 20) : null,
        email: kdm2_email ? String(kdm2_email).slice(0, 255) : null,
        linkedin_url: kdm2_linkedin ? String(kdm2_linkedin).slice(0, 500) : null,
        is_primary: false,
      })
    }

    // Insert KDM3 (tertiary contact)
    if (kdm3_name) {
      await supabase.from('contacts').insert({
        org_id: org.id,
        name: String(kdm3_name).slice(0, 255),
        designation: kdm3_designation ? String(kdm3_designation).slice(0, 100) : null,
        phone: kdm3_phone ? String(kdm3_phone).slice(0, 20) : null,
        email: kdm3_email ? String(kdm3_email).slice(0, 255) : null,
        linkedin_url: kdm3_linkedin ? String(kdm3_linkedin).slice(0, 500) : null,
        is_primary: false,
      })
    }

    // Create lead record (starts in SDR queue)
    await supabase.from('leads').insert({
      org_id: org.id,
      dataset_id,
      status: 'new',
      phase: 'sdr',
    })

    created++
  }

  // Update dataset record count
  await supabase
    .from('datasets')
    .update({ total_records: created })
    .eq('id', dataset_id)

  return NextResponse.json({ created, skipped, duplicates, errors })
}
