import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await authClient.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 }) }
  }
  return { ok: true as const }
}

// GET /api/datasets/:id — lead breakdown for this dataset (admin only), powering the
// delete-confirm modal: { total, unassigned, assigned, in_pipeline, won }.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdmin()
  if (!a.ok) return a.res
  const supabase = createServiceClient() as any  // rpc() to custom functions not in generated types
  const { data, error } = await supabase.rpc('dataset_stats', { p_dataset_id: params.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json(row ?? { total: 0, unassigned: 0, assigned: 0, in_pipeline: 0, won: 0 })
}

// DELETE /api/datasets/:id?scope=unassigned|unprogressed|all — HARD delete (admin only).
// Permanently removes the dataset's leads (per scope) + their activities/demos/deals
// (FK cascade) + orphaned non-banned orgs/contacts. 'all' also removes the dataset row.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdmin()
  if (!a.ok) return a.res
  const scope = new URL(req.url).searchParams.get('scope') ?? ''
  if (!['unassigned', 'unprogressed', 'all'].includes(scope)) {
    return NextResponse.json({ error: 'Invalid scope (unassigned | unprogressed | all)' }, { status: 400 })
  }
  const supabase = createServiceClient() as any  // rpc() to custom functions not in generated types
  const { data, error } = await supabase.rpc('dataset_purge', { p_dataset_id: params.id, p_scope: scope })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json(row ?? { leads_deleted: 0, orgs_deleted: 0 })
}
