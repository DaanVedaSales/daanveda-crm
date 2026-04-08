import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/onboarding — create user profile after signup, with role selection
// Only SDR and Closer allowed via self-signup. Admin/Sales Ops must be invited by admin.
export async function POST(req: NextRequest) {
  const supabase = createClient()

  // Must be authenticated (just signed up)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated. Please sign up first.' }, { status: 401 })
  }

  // Check if profile already exists (prevent duplicate onboarding)
  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (existing) {
    // Already onboarded — just return their role
    return NextResponse.json({ role: existing.role, already_setup: true })
  }

  const body = await req.json()
  const { role } = body

  // SECURITY: only SDR and Closer can self-register
  // Admin and Sales Ops must be created by an existing admin
  const SELF_SIGNUP_ROLES = ['sdr', 'closer']
  if (!role || !SELF_SIGNUP_ROLES.includes(role)) {
    return NextResponse.json(
      { error: 'Invalid role. Admin and Sales Ops accounts must be created by your manager.' },
      { status: 400 }
    )
  }

  // Get name from auth metadata (set during signup)
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member'

  // Create user profile
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: user.id,
      email: user.email!,
      name,
      role,
      is_active: true,
    })
    .select('id, name, email, role')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, message: 'Profile created successfully.' }, { status: 201 })
}
