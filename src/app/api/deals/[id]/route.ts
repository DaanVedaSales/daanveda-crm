import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/deals/:id — update deal stage, follow-up, billing info
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { stage, deal_value, plan_type, next_follow_up, loss_reason,
    billing_name, billing_address, gst_number, payment_confirmed, onboarding_issued } = body

  // Validate: loss_reason MANDATORY when stage = lost
  if (stage === 'lost' && !loss_reason) {
    return NextResponse.json({ error: 'Loss reason is mandatory when marking a deal as lost.' }, { status: 400 })
  }

  // Validate: billing_name MANDATORY when stage = won
  if (stage === 'won' && !billing_name) {
    return NextResponse.json({ error: 'Billing name is mandatory when marking a deal as won.' }, { status: 400 })
  }

  const supabase = createClient()

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (stage) {
    updatePayload.stage = stage
    if (['won', 'lost'].includes(stage)) {
      updatePayload.date_won_lost = new Date().toISOString().split('T')[0]
    }
  }
  if (deal_value !== undefined) updatePayload.deal_value = deal_value
  if (plan_type !== undefined) updatePayload.plan_type = plan_type
  if (next_follow_up !== undefined) updatePayload.next_follow_up = next_follow_up
  if (loss_reason !== undefined) updatePayload.loss_reason = loss_reason
  if (billing_name !== undefined) updatePayload.billing_name = billing_name
  if (billing_address !== undefined) updatePayload.billing_address = billing_address
  if (gst_number !== undefined) updatePayload.gst_number = gst_number
  if (payment_confirmed !== undefined) updatePayload.payment_confirmed = payment_confirmed
  if (onboarding_issued !== undefined) updatePayload.onboarding_issued = onboarding_issued

  // Increment follow-up counter if updating follow-up date
  if (next_follow_up) {
    updatePayload.follow_up_count = supabase.rpc('increment_follow_up', { deal_id: params.id })
  }

  const { data, error } = await supabase
    .from('deals')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
