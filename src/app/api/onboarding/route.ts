import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/onboarding — create user profile after signup
// Uses service client to bypass RLS (chicken-and-egg: new user has no profile yet
// so RLS would block them from inserting their own first row)
export async function POST(req: NextRequest) {
  // Verify the user is authenticated
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated. Please sign up first.' }, { status: 401 })
  }

  // Use service client to bypass RLS for the initial profile creation
  const supabase = createServiceClient()

  // Check if profile already exists (prevent duplicate onboarding)
  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ role: existing.role, already_setup: true })
  }

  const body = await req.json()
  const { role } = body

  // SECURITY: only SDR and Closer can self-register
  const SELF_SIGNUP_ROLES = ['sdr', 'closer']
  if (!role || !SELF_SIGNUP_ROLES.includes(role)) {
    return NextResponse.json(
      { error: 'Invalid role. Admin and Sales Ops accounts must be created by your manager.' },
      { status: 400 }
    )
  }

  // Get name from auth metadata
  const name = user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || 'Team Member'

  // Create user profile using service role (bypasses RLS)
  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: user.id,
      email: user.email!,
      name,
      role,
      is_active: true,
      monthly_demo_target: null,   // Admin will set this from team page
      monthly_revenue_target: null, // Admin will set this from team page
    })
    .select('id, name, email, role')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, message: 'Profile created successfully.' }, { status: 201 })
}
