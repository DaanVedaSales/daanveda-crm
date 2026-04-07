import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

// PATCH /api/users/:id — update role, targets, name, phone (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: Verify caller is authenticated AND is an admin
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerProfile } = await authClient
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { name, role, phone, monthly_demo_target, monthly_revenue_target, is_active } = body

  // Whitelist valid roles to prevent privilege escalation
  const VALID_ROLES = ['admin', 'sdr', 'closer', 'sales_ops']
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updatePayload.name = name
  if (role !== undefined) updatePayload.role = role
  if (phone !== undefined) updatePayload.phone = phone
  if (monthly_demo_target !== undefined) updatePayload.monthly_demo_target = Number(monthly_demo_target)
  if (monthly_revenue_target !== undefined) updatePayload.monthly_revenue_target = Number(monthly_revenue_target)
  if (is_active !== undefined) updatePayload.is_active = Boolean(is_active)

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
