import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SQL_SCORE_RUBRIC } from '@/lib/constants'

const MAX_ROWS_PER_UPLOAD = 5000 // DoS protection

function calculateSQLScore(org: {
  annual_revenue?: number | null
  team_size?: number | null
  age_years?: number | null
  url?: string | null
  linkedin_url?: string | null
  thematic_areas?: string[] | null
  location?: string | null
}, hasKdmEmail: boolean): number {
  let score = 0
  if (org.annual_revenue && org.annual_revenue >= 5000000) score++
  if (org.team_size && org.team_size >= 10) score++
  if (org.age_years && org.age_years >= 3) score++
  if (org.url) score++
  if (org.linkedin_url) score++
  if (org.thematic_areas && org.thematic_areas.length > 0) score++
  if (org.location) score++
  if (hasKdmEmail) score++
  return Math.min(score, 8)
}

// POST /api/datasets/upload — bulk create orgs + contacts from CSV rows (admin only)
export async function POST(req: NextRequest) {
  const supabase = createClient()

  // Auth + admin role check
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

  // DoS protection: cap rows per request
  if (rows.length > MAX_ROWS_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ROWS_PER_UPLOAD} rows per upload. Split your CSV into smaller batches.` },
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
      age_years, linkedin_url,
      kdm_name, kdm_phone, kdm_email, kdm_designation
    } = row

    if (!name || typeof name !== 'string') { skipped++; continue }

    // Sanitize name — trim and cap length
    const cleanName = name.trim().slice(0, 255)
    if (!cleanName) { skipped++; continue }

    // Check for duplicate (name match)
    const { data: existing } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', cleanName)
      .limit(1)
      .single()

    if (existing) {
      duplicates.push(cleanName)
      skipped++
      continue
    }

    const hasKdmEmail = !!kdm_email

    // Parse thematic_areas — may come as string or array
    let thematicArr: string[] = []
    if (Array.isArray(thematic_areas)) thematicArr = thematic_areas
    else if (typeof thematic_areas === 'string') {
      thematicArr = thematic_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    const sql_score = calculateSQLScore({
      annual_revenue: annual_revenue ? Number(annual_revenue) : null,
      team_size: team_size ? Number(team_size) : null,
      age_years: age_years ? Number(age_years) : null,
      url: url || null,
      linkedin_url: linkedin_url || null,
      thematic_areas: thematicArr,
      location: location || null,
    }, hasKdmEmail)

    // Insert organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        dataset_id,
        name: cleanName,
        url: url ? String(url).slice(0, 500) : null,
        linkedin_url: linkedin_url ? String(linkedin_url).slice(0, 500) : null,
        location: location ? String(location).slice(0, 255) : null,
        thematic_areas: thematicArr.length > 0 ? thematicArr : null,
        annual_revenue: annual_revenue ? Number(annual_revenue) : null,
        team_size: team_size ? Number(team_size) : null,
        age_years: age_years ? Number(age_years) : null,
        sql_score,
      })
      .select()
      .single()

    if (orgError) { errors.push(`${cleanName}: ${orgError.message}`); continue }

    // Insert contact (KDM) if provided
    if (kdm_name) {
      await supabase.from('contacts').insert({
        org_id: org.id,
        name: String(kdm_name).slice(0, 255),
        designation: kdm_designation ? String(kdm_designation).slice(0, 100) : null,
        phone: kdm_phone ? String(kdm_phone).slice(0, 20) : null,
        email: kdm_email ? String(kdm_email).slice(0, 255) : null,
        is_primary: true,
      })
    }

    // Create lead record
    await supabase.from('leads').insert({
      org_id: org.id,
      dataset_id,
      status: 'new',
      phase: 'sdr',
    })

    created++
  }

  // Update dataset total_records
  await supabase
    .from('datasets')
    .update({ total_records: created })
    .eq('id', dataset_id)

  return NextResponse.json({ created, skipped, duplicates, errors })
}
