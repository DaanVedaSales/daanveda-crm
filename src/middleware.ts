import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — allow without auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||   // /auth/callback for invite + password reset links
    pathname === '/login' ||
    pathname === '/signup' ||          // kept: shows invite-only message without requiring auth
    pathname === '/set-password' ||    // accessible during recovery flow before workspace redirect
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Get session
  const { supabaseResponse, user } = await updateSession(request)

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Check if user has a profile in the users table
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  // Authenticated but no profile → send to onboarding
  // (allows /onboarding through without loop)
  if (!profile) {
    if (pathname === '/onboarding') return NextResponse.next()
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  const workspaceMap: Record<string, string> = {
    admin: '/admin',
    sdr: '/sdr',
    closer: '/closer',
    sales_ops: '/admin',
  }

  // Root redirect → send to role workspace
  if (pathname === '/') {
    return NextResponse.redirect(new URL(workspaceMap[profile.role] ?? '/sdr', request.url))
  }

  // Onboarding already done → don't let them go back to onboarding
  if (pathname === '/onboarding') {
    return NextResponse.redirect(new URL(workspaceMap[profile.role] ?? '/sdr', request.url))
  }

  // Enforce workspace boundaries — each role can only access their section
  const userWorkspace = workspaceMap[profile.role] ?? '/sdr'
  const isAllowed = pathname.startsWith(userWorkspace)

  if (!isAllowed) {
    return NextResponse.redirect(new URL(userWorkspace, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
