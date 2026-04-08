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
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/onboarding' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Get session
  const { supabaseResponse, user } = await updateSession(request)

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Root redirect
  if (pathname === '/') {
    // Get user role from users table
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

    const role = profile?.role ?? 'sdr'
    const workspaceMap: Record<string, string> = {
      admin: '/admin',
      sdr: '/sdr',
      closer: '/closer',
      sales_ops: '/admin',
    }
    return NextResponse.redirect(new URL(workspaceMap[role] ?? '/sdr', request.url))
  }

  // Enforce workspace boundaries
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

  const role = profile?.role ?? 'sdr'

  const workspaceMap: Record<string, string> = {
    admin: '/admin',
    sdr: '/sdr',
    closer: '/closer',
    sales_ops: '/admin',
  }

  const userWorkspace = workspaceMap[role] ?? '/sdr'
  const allowedPrefixes = [userWorkspace]

  const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix))
  if (!isAllowed) {
    return NextResponse.redirect(new URL(userWorkspace, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
