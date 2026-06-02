import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { toISTDateString, istDayStart, istDayEnd, IST_TIMEZONE } from '@/lib/utils'

// POST /api/email/daily-summary
// Called by pg_cron at 9AM IST (3:30 AM UTC) Mon–Sat
// type: "morning" | "evening"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const type = body.type ?? 'morning'

  // Verify this is called from pg_cron or internal service
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = toISTDateString()   // IST calendar day

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email, role, monthly_demo_target, monthly_revenue_target')
    .eq('is_active', true)

  if (!users?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const user of users) {
    try {
      let subject = ''
      let html = ''

      if (type === 'morning') {
        // Build morning summary per role
        if (user.role === 'sdr') {
          const { count: demos } = await supabase
            .from('demos').select('id', { count: 'exact', head: true })
            .eq('sdr_id', user.id)
            .gte('created_at', istDayStart(`${today.slice(0, 7)}-01`))

          const { count: followups } = await supabase
            .from('leads').select('id', { count: 'exact', head: true })
            .eq('assigned_to', user.id)
            .lte('follow_up_date', today)
            .in('status', ['call_again', 'follow_up'])

          subject = `DaanVeda CRM — Good morning, ${user.name.split(' ')[0]} 🌅`
          html = buildSDRMorningEmail(user.name, demos ?? 0, user.monthly_demo_target, followups ?? 0, today)
        }

        if (user.role === 'closer') {
          const { data: todayDemos } = await supabase
            .from('demos').select('id, demo_date, organization:organizations(name)')
            .eq('closer_id', user.id)
            .gte('demo_date', istDayStart(today))
            .lte('demo_date', istDayEnd(today))

          const { count: overdue } = await supabase
            .from('deals').select('id', { count: 'exact', head: true })
            .eq('closer_id', user.id)
            .lte('next_follow_up', today)
            .not('stage', 'in', '("won","lost","ghosted")')

          subject = `DaanVeda CRM — ${todayDemos?.length ?? 0} demos today`
          html = buildCloserMorningEmail(user.name, todayDemos ?? [], overdue ?? 0)
        }
      }

      if (!subject) continue

      // Send via Resend
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@daanveda.com',
          to: user.email,
          subject,
          html,
        }),
      })

      if (resendRes.ok) sent++
    } catch (e) {
      console.error(`Failed to send to ${user.email}:`, e)
    }
  }

  return NextResponse.json({ sent, type, users: users.length })
}

function buildSDRMorningEmail(name: string, demos: number, target: number, followups: number, today: string): string {
  const pct = target > 0 ? Math.round((demos / target) * 100) : 0
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="background: #1A56DB; color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 20px;">Good morning, ${name.split(' ')[0]}! 👋</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${today}</p>
      </div>

      <div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B;">DEMOS THIS MONTH</p>
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #0F172A;">${demos} <span style="font-size: 16px; color: #64748B;">/ ${target} (${pct}%)</span></p>
      </div>

      ${followups > 0 ? `
      <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 14px; color: #92400E;">⚠️ <strong>${followups} follow-up${followups > 1 ? 's' : ''}</strong> due today — check your follow-up queue.</p>
      </div>` : `
      <div style="background: #D1FAE5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 14px; color: #065F46;">✅ All follow-ups are clear. Have a great day!</p>
      </div>`}

      <p style="text-align: center; margin-top: 24px;"><a href="${process.env.NEXT_PUBLIC_APP_URL}/sdr" style="background: #1A56DB; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Open My Workspace →</a></p>

      <p style="text-align: center; font-size: 11px; color: #94A3B8; margin-top: 24px;">DaanVeda CRM · Internal tool</p>
    </div>
  `
}

function buildCloserMorningEmail(name: string, demos: any[], overdue: number): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="background: #059669; color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 20px;">Good morning, ${name.split(' ')[0]}! 👋</h1>
        <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${demos.length} demo${demos.length !== 1 ? 's' : ''} scheduled today</p>
      </div>

      ${demos.map(d => `
        <div style="background: #F8FAFC; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
          <p style="margin: 0; font-weight: 600; font-size: 14px; color: #0F172A;">${(d.organization as any)?.name ?? 'Unknown'}</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748B;">${new Date(d.demo_date).toLocaleTimeString('en-IN', { timeZone: IST_TIMEZONE, hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      `).join('')}

      ${overdue > 0 ? `
        <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin-top: 16px;">
          <p style="margin: 0; font-size: 14px; color: #92400E;">⚠️ <strong>${overdue} follow-up${overdue > 1 ? 's' : ''}</strong> overdue in your pipeline.</p>
        </div>` : ''}

      <p style="text-align: center; margin-top: 24px;"><a href="${process.env.NEXT_PUBLIC_APP_URL}/closer" style="background: #059669; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Open Pipeline →</a></p>

      <p style="text-align: center; font-size: 11px; color: #94A3B8; margin-top: 24px;">DaanVeda CRM · Internal tool</p>
    </div>
  `
}
