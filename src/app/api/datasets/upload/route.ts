import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_ROWS_PER_UPLOAD = 5000 // DoS protection

// Build a contacts insert payload from a KDM block (shared by create + enrich paths).
function contactPayload(orgId: string, k: any, isPrimary: boolean) {
  return {
    org_id: orgId,
    name: String(k.name).slice(0, 255),
    designation: k.designation ? String(k.designation).slice(0, 100) : null,
    phone: k.phone ? String(k.phone).slice(0, 20) : null,
    email: k.email ? String(k.email).slice(0, 255) : null,
    linkedin_url: k.linkedin ? String(k.linkedin).slice(0, 500) : null,
    is_primary: isPrimary,
  }
}

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

  let created = 0    // brand-new orgs created
  let enriched = 0   // existing orgs that gained new contacts and/or a lead
  let skipped = 0    // rows left untouched (no name / existing-with-nothing-new / banned / org insert failed)
  const duplicates: string[] = []  // existing orgs left unchanged
  const errors: string[] = []      // per-insert failures (surfaced to the admin, no longer swallowed)

  for (const row of rows) {
    const {
      name, url, location, annual_revenue, team_size, thematic_areas,
      age_years, linkedin_url, sql_score_label,
      is_client,
      kdm_name, kdm_phone, kdm_email, kdm_designation, kdm_linkedin,
      kdm2_name, kdm2_phone, kdm2_email, kdm2_designation, kdm2_linkedin,
      kdm3_name, kdm3_phone, kdm3_email, kdm3_designation, kdm3_linkedin,
    } = row

    // Parse is_client — truthy: "yes" / "true" / "1" / "y" (case-insensitive)
    const isClient = typeof is_client === 'boolean'
      ? is_client
      : ['yes', 'true', '1', 'y'].includes(String(is_client ?? '').trim().toLowerCase())

    // Org name is the only required field
    if (!name || typeof name !== 'string') { skipped++; continue }
    const cleanName = name.trim().slice(0, 255)
    if (!cleanName) { skipped++; continue }

    // KDMs present in this row, in order (KDM1 is the primary candidate)
    const kdms = [
      { name: kdm_name,  phone: kdm_phone,  email: kdm_email,  designation: kdm_designation,  linkedin: kdm_linkedin },
      { name: kdm2_name, phone: kdm2_phone, email: kdm2_email, designation: kdm2_designation, linkedin: kdm2_linkedin },
      { name: kdm3_name, phone: kdm3_phone, email: kdm3_email, designation: kdm3_designation, linkedin: kdm3_linkedin },
    ].filter(k => k.name && String(k.name).trim())

    // ── Existing org? Enrich it instead of dropping the whole row ──────────────
    const { data: existing } = await supabase
      .from('organizations')
      .select('id, is_banned, is_client')
      .ilike('name', cleanName)
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Banned (do-not-contact) → never add contacts or a lead
      if (existing.is_banned) { duplicates.push(cleanName); skipped++; continue }

      let didEnrich = false

      // Add KDMs that aren't already on the org (dedupe by name, case-insensitive)
      const { data: existingContacts } = await supabase.from('contacts').select('name').eq('org_id', existing.id)
      const have = new Set((existingContacts ?? []).map((c: any) => String(c.name ?? '').trim().toLowerCase()))
      let orgHasNoContacts = (existingContacts ?? []).length === 0
      for (const k of kdms) {
        const key = String(k.name).trim().toLowerCase()
        if (have.has(key)) continue
        // First KDM becomes primary only if the org currently has no contacts at all.
        const { error } = await supabase.from('contacts').insert(contactPayload(existing.id, k, orgHasNoContacts))
        if (error) errors.push(`${cleanName} (KDM ${k.name}): ${error.message}`)
        else { didEnrich = true; have.add(key); orgHasNoContacts = false }
      }

      // Ensure a lead exists — only when the org has NO active lead and isn't a client.
      // (Won't resurrect a deliberately returned/converted lead — those still exist.)
      if (!existing.is_client) {
        const { count } = await supabase
          .from('leads').select('id', { count: 'exact', head: true })
          .eq('org_id', existing.id).eq('is_deleted', false)
        if ((count ?? 0) === 0) {
          const { error } = await supabase.from('leads').insert({ org_id: existing.id, dataset_id, status: 'new', phase: 'sdr' })
          if (error) errors.push(`${cleanName} (lead): ${error.message}`)
          else didEnrich = true
        }
      }

      if (didEnrich) enriched++
      else { duplicates.push(cleanName); skipped++ }
      continue
    }

    // ── New org ────────────────────────────────────────────────────────────────
    // Parse thematic_areas — may come as comma-separated string or array
    let thematicArr: string[] = []
    if (Array.isArray(thematic_areas)) thematicArr = thematic_areas
    else if (typeof thematic_areas === 'string' && thematic_areas.trim()) {
      thematicArr = thematic_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    // Insert organization (sql_score_label stored as-is — pre-scored externally)
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
        is_client: isClient,
      })
      .select('id')
      .single()

    if (orgError || !org) { errors.push(`${cleanName}: ${orgError?.message ?? 'org insert failed'}`); skipped++; continue }

    // Insert KDMs (KDM1 primary, rest secondary) — failures are reported, not swallowed
    for (let i = 0; i < kdms.length; i++) {
      const { error } = await supabase.from('contacts').insert(contactPayload(org.id, kdms[i], i === 0))
      if (error) errors.push(`${cleanName} (KDM ${kdms[i].name}): ${error.message}`)
    }

    // Create lead record (starts in SDR queue) — skip for existing clients
    if (!isClient) {
      const { error: leadErr } = await supabase.from('leads').insert({ org_id: org.id, dataset_id, status: 'new', phase: 'sdr' })
      if (leadErr) errors.push(`${cleanName} (lead): ${leadErr.message}`)
    }

    created++
  }

  // Record count = brand-new orgs + existing orgs this upload enriched
  await supabase
    .from('datasets')
    .update({ total_records: created + enriched })
    .eq('id', dataset_id)

  return NextResponse.json({ created, enriched, skipped, duplicates, errors })
}
