import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

// Helper: verify caller is authenticated admin
async function requireAdmin() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, profile: null }

  const { data: profile } = await authClient
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: 'Forbidden: admin access required', status: 403, profile: null }
  }

  return { error: null, status: 200, profile }
}

// GET /api/users — list all users (admin only)
export async function GET() {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const supabase = createServiceClient()
  const { data, error: dbError } = await supabase
    .from('users')
    .select('id, name, email, role, phone, is_active, monthly_demo_target, monthly_revenue_target, created_at')
    .order('created_at', { ascending: true })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/users — invite new user (admin only)
export async function POST(req: NextRequest) {
  const { error, status } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { email, name, role } = body

  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, and role are required' }, { status: 400 })
  }

  const VALID_ROLES = ['admin', 'sdr', 'closer', 'sales_ops']
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { data, error: dbError } = await supabase
    .from('users')
    .insert({ auth_id: authData.user.id, email, name, role })
    .select('id, name, email, role, created_at')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
