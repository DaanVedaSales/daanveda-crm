import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyRole } from '@/lib/notifications'

// POST /api/deals/[id]/ban-request
// A closer requests that this deal's organisation be banned. Mirrors the SDR "Banned"
// outcome exactly: it does NOT ban the org (is_banned stays admin-only). Instead it
//   1. soft-deletes the in-flight deal + demo (expunged from the Kanban, like a permanent delete),
//   2. routes the lead into the admin Ban Requests pool (phase='dead', returned_reason='ban_requested'),
//   3. logs an activity + notifies admins.
// Admin then confirms the ban via the existing Returned-tab Confirm Ban flow.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient
    .from('users').select('id, role, name').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient() as any
  const { data: deal } = await supabase
    .from('deals').select('id, lead_id, org_id, demo_id, closer_id').eq('id', params.id).single()
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Ownership: the deal's own closer, or an admin.
  if ((profile as any).role !== 'admin' && deal.closer_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()

  // 1. Soft-delete the deal + its demo (expunged from the pipeline — same as permanent delete).
  await supabase.from('deals').update({ is_deleted: true, deleted_at: now }).eq('id', deal.id)
  if (deal.demo_id) {
    await supabase.from('demos').update({ is_deleted: true, deleted_at: now }).eq('id', deal.demo_id)
  } else if (deal.lead_id) {
    // Defensive: catch any demo linked only by lead (normally none for a demo-less deal).
    await supabase.from('demos').update({ is_deleted: true, deleted_at: now }).eq('lead_id', deal.lead_id)
  }

  // 2. Route the lead to the admin Ban Requests pool (visible, NOT deleted).
  if (deal.lead_id) {
    await supabase.from('leads').update({
      phase: 'dead',
      returned_reason: 'ban_requested',
      is_deleted: false,
      updated_at: now,
    }).eq('id', deal.lead_id)

    // 3. Audit note.
    await supabase.from('activities').insert({
      lead_id: deal.lead_id,
      org_id: deal.org_id,
      user_id: (profile as any).id,
      activity_type: 'note',
      notes: `Organisation ban requested by closer${(profile as any).name ? ` ${(profile as any).name}` : ''} — sent to admin for confirmation. Deal removed from pipeline.`,
      new_value: 'ban_requested',
    })
  }

  // Notify admins (best-effort — never blocks the request).
  const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', deal.org_id).single()
  await notifyRole('admin', {
    actorId: (profile as any).id,
    type: 'ban_requested',
    title: 'Ban requested',
    body: `${(profile as any).name ?? 'A closer'} requested to ban ${orgRow?.name ?? 'an organisation'}. Review in the Returned tab.`,
    link: '/admin/leads',
  })

  return NextResponse.json({ success: true })
}
