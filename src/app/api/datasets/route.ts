import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper: verify authenticated admin
async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, status: 401, error: 'Unauthorized', profile: null }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { authorized: false, status: 403, error: 'Forbidden: admin access required', profile: null }
  }

  return { authorized: true, status: 200, error: null, profile }
}

// GET /api/datasets — list all datasets (admin only)
export async function GET() {
  const supabase = createClient()
  const { authorized, status, error } = await requireAdmin(supabase)
  if (!authorized) return NextResponse.json({ error }, { status })

  const { data, error: dbError } = await supabase
    .from('datasets')
    .select('*, uploader:users!datasets_uploaded_by_fkey(id, name)')
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/datasets — create dataset record (admin only)
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { authorized, status, error, profile } = await requireAdmin(supabase)
  if (!authorized) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { name, source, notes } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Dataset name is required' }, { status: 400 })
  }

  const { data, error: dbError } = await supabase
    .from('datasets')
    .insert({
      name: name.trim().slice(0, 255),
      source: source ? String(source).slice(0, 100) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      uploaded_by: profile!.id,
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
