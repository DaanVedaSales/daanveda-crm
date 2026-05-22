import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Auth callback — handles two flows:
 *
 * 1. Invite link  : admin invites user → Supabase sends email → user clicks →
 *                   lands here with ?code=XXX&type=invite → exchange code →
 *                   route to /set-password so they can set their first password
 *
 * 2. Password reset: user clicks "Forgot password" → Supabase sends email → clicks →
 *                   lands here with ?code=XXX&next=/set-password → exchange code →
 *                   route to /set-password so they can set a new password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') // '/set-password' for recovery flow
  const type = searchParams.get('type') // 'invite' for new user invite flow

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // Start with a placeholder redirect — we'll update the destination after the exchange
  const response = NextResponse.redirect(`${origin}/`)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=invite_expired`)
  }

  // Invite flow OR recovery flow → both send to /set-password
  if (type === 'invite' || next === '/set-password') {
    const dest = NextResponse.redirect(`${origin}/set-password`)
    response.cookies.getAll().forEach(c => dest.cookies.set(c.name, c.value, { path: '/' }))
    return dest
  }

  // Fallback (e.g. OAuth, magic link without type param) → determine workspace from profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  const roleMap: Record<string, string> = {
    admin: '/admin',
    sdr: '/sdr',
    closer: '/closer',
    sales_ops: '/admin',
  }

  const dest = profile?.role ? (roleMap[profile.role] ?? '/sdr') : '/sdr'
  const finalResponse = NextResponse.redirect(`${origin}${dest}`)
  response.cookies.getAll().forEach(c => finalResponse.cookies.set(c.name, c.value, { path: '/' }))
  return finalResponse
}
