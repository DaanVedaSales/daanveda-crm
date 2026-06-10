import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/datasets/:id/breakdown — per-assignee breakdown for a dataset (admin only):
// [{ assignee, assignee_name, role, assigned, demos, won }] incl. an "Unassigned" row.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await authClient.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }
  const supabase = createServiceClient() as any // rpc() to custom function not in generated types
  const { data, error } = await supabase.rpc('dataset_assignment_breakdown', { p_dataset_id: params.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(Array.isArray(data) ? data : [])
}
