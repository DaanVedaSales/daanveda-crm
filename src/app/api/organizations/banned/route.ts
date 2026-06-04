import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Verify the caller is an admin
async function requireAdmin() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await authClient
    .from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { error: 'Forbidden: admin access required', status: 403 as const }
  }
  return { error: null, status: 200 as const }
}

// GET /api/organizations/banned — list all banned orgs + count (admin only)
export async function GET() {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const supabase = createServiceClient()
  const { data, error: qErr } = await supabase
    .from('organizations')
    .select('id, name, location, ban_reason, created_at')
    .eq('is_banned', true)
    .order('name', { ascending: true })

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
  return NextResponse.json({ count: data?.length ?? 0, organizations: data ?? [] })
}

// POST /api/organizations/banned — register a new banned org (admin only).
// Creates ONLY an organisation row (no lead / contact / pipeline entry).
// Body: { name* , location* (city), url?, linkedin_url?, thematic_areas?, ban_reason? }
// If an org with the same name already exists, it is marked banned instead of duplicated.
export async function POST(req: NextRequest) {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const location = String(body.location ?? '').trim()
  if (!name || !location) {
    return NextResponse.json({ error: 'Organisation name and city are required.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const ban_reason = body.ban_reason ? String(body.ban_reason).trim() || null : null

  // Dedupe: if an org with this exact name already exists, ban that one
  const { data: existing } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', name)
    .limit(1)

  if (existing && existing.length > 0) {
    const { data, error: updErr } = await supabase
      .from('organizations')
      .update({ is_banned: true, ban_reason, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id)
      .select('id, name, location, ban_reason, created_at')
      .single()
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    return NextResponse.json({ ...data, already_existed: true })
  }

  const { data, error: insErr } = await supabase
    .from('organizations')
    .insert({
      name,
      location,
      url: body.url ? String(body.url).trim() || null : null,
      linkedin_url: body.linkedin_url ? String(body.linkedin_url).trim() || null : null,
      thematic_areas: Array.isArray(body.thematic_areas) && body.thematic_areas.length ? body.thematic_areas : null,
      is_banned: true,
      ban_reason,
    })
    .select('id, name, location, ban_reason, created_at')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json(data)
}
