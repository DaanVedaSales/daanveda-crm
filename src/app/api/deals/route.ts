import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/deals — closer's active pipeline
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const closerId = searchParams.get('closer_id')
  const stage = searchParams.get('stage')

  const supabase = createClient()

  let query = supabase
    .from('deals')
    .select(`
      *,
      organization:organizations(id, name, location, annual_revenue, team_size, thematic_areas, linkedin_url, url),
      demo:demos(id, demo_date, pain_point, demo_expectation, sdr_summary, sdr_interest_signal, sdr:users!demos_sdr_id_fkey(id, name))
    `)
    .order('updated_at', { ascending: false })

  if (closerId) query = query.eq('closer_id', closerId)
  if (stage) query = query.eq('stage', stage)
  // Never return removed-from-board deals (ghosted soft-delete)
  query = query.or('removed_from_board.is.null,removed_from_board.eq.false')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
