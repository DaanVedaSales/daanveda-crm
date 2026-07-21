import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cleanupOldNotifications } from '@/lib/maintenance'

// GET/POST /api/cron/sheet-sync
// Pushes the unified per-lead journey rows to the UniSheet webhook.
// Triggered by Vercel Cron (GET, twice daily) or manually (POST) — both
// require `Authorization: Bearer ${CRON_SECRET}`.
//
// Accuracy model: sheet_sync_rows is a per-lead dirty queue. A run marks
// leads whose journey changed since the last cursor, then pushes dirty rows
// one by one (UniSheet batch mode is buggy — single-row calls only). A row is
// only marked clean after UniSheet confirms the upsert, so failures are
// retried on the next run and the sheet always converges to the database.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH_SIZE = 400
const TIME_BUDGET_MS = 250_000 // leave headroom under maxDuration
const CURSOR_OVERLAP_MS = 5 * 60 * 1000 // re-scan window; upserts are idempotent

type SheetOp = 'upsert' | 'delete'

async function pushToSheet(url: string, operation: SheetOp, data: Record<string, string>): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, data }),
      signal: controller.signal,
    })
    if (res.ok) return true
    // deleting a row that's already gone counts as done
    if (operation === 'delete' && res.status === 404) return true
    return false
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function runSync() {
  const webhookUrl = process.env.UNISHEET_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'UNISHEET_WEBHOOK_URL not configured' }, { status: 503 })
  }

  const startedAt = Date.now()
  const supabase = createServiceClient() as any

  // 1) Mark leads whose journey changed since the last cursor (with overlap)
  const { data: state, error: stateErr } = await supabase
    .from('sheet_sync_state').select('*').eq('id', 1).single()
  if (stateErr) {
    return NextResponse.json({ error: `state read failed: ${stateErr.message}` }, { status: 500 })
  }
  const since = state?.last_cursor
    ? new Date(new Date(state.last_cursor).getTime() - CURSOR_OVERLAP_MS)
    : new Date(0)
  const newCursor = new Date().toISOString()

  const { data: marked, error: markErr } = await supabase
    .rpc('sheet_mark_changed', { since: since.toISOString() })
  if (markErr) {
    // do not advance the cursor — nothing was marked, retry next run
    return NextResponse.json({ error: `mark failed: ${markErr.message}` }, { status: 500 })
  }

  // 2) Leads hard-deleted from the CRM → remove their sheet rows
  let deleted = 0
  let deleteFailed = 0
  const { data: orphans } = await supabase.rpc('sheet_orphan_rows')
  for (const leadId of (orphans ?? []) as string[]) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    const ok = await pushToSheet(webhookUrl, 'delete', { 'Lead ID': leadId })
    if (ok) {
      await supabase.from('sheet_sync_rows').delete().eq('lead_id', leadId)
      deleted++
    } else {
      deleteFailed++
    }
  }

  // 3) Push dirty rows (oldest first), one upsert per lead
  let pushed = 0
  let failed = 0
  const { data: dirtyRows, error: dirtyErr } = await supabase
    .from('sheet_sync_rows')
    .select('lead_id')
    .eq('dirty', true)
    .order('dirtied_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (dirtyErr) {
    return NextResponse.json({ error: `dirty read failed: ${dirtyErr.message}` }, { status: 500 })
  }

  const ids = ((dirtyRows ?? []) as { lead_id: string }[]).map(r => r.lead_id)
  if (ids.length > 0) {
    const { data: rows, error: rowsErr } = await supabase.rpc('sheet_lead_rows', { ids })
    if (rowsErr) {
      return NextResponse.json({ error: `row build failed: ${rowsErr.message}` }, { status: 500 })
    }
    const done: string[] = []
    for (const r of (rows ?? []) as { out_lead_id: string; out_row: Record<string, string> }[]) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break
      const ok = await pushToSheet(webhookUrl, 'upsert', r.out_row)
      if (ok) {
        done.push(r.out_lead_id)
        pushed++
      } else {
        failed++
      }
    }
    if (done.length > 0) {
      await supabase
        .from('sheet_sync_rows')
        .update({ dirty: false, last_pushed_at: new Date().toISOString() })
        .in('lead_id', done)
    }
  }

  // 4) Advance the cursor (marking succeeded; failures stay dirty and retry)
  const { count: remaining } = await supabase
    .from('sheet_sync_rows')
    .select('lead_id', { count: 'exact', head: true })
    .eq('dirty', true)

  const result = {
    marked: marked ?? 0,
    pushed,
    failed,
    deleted,
    deleteFailed,
    remaining: remaining ?? 0,
    tookMs: Date.now() - startedAt,
  }
  await supabase
    .from('sheet_sync_state')
    .update({ last_cursor: newCursor, last_run_at: new Date().toISOString(), last_result: result })
    .eq('id', 1)

  return NextResponse.json(result)
}

// This is the app's daily heartbeat cron, so daily housekeeping rides it (best-effort,
// never throws). Runs regardless of whether the UniSheet leg is configured.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await cleanupOldNotifications()
  return runSync()
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await cleanupOldNotifications()
  return runSync()
}
