// Ownership guard for modifying an org's KDM contacts (edit / add / set-primary).
// Admin may modify any. Otherwise the caller must be genuinely working that org:
//   - SDR: has a lead assigned to them, or a demo they booked, on the org.
//   - Closer: has a deal or a demo assigned to them on the org.
// Pass a SERVICE client so the checks aren't limited by RLS. Returns true = allowed.
export async function canModifyOrgContacts(
  service: any,
  userId: string,
  role: string,
  orgId: string | null | undefined,
): Promise<boolean> {
  if (role === 'admin') return true
  if (!userId || !orgId) return false

  if (role === 'sdr') {
    const [leadRes, demoRes] = await Promise.all([
      service.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', userId).eq('org_id', orgId),
      service.from('demos').select('id', { count: 'exact', head: true }).eq('sdr_id', userId).eq('org_id', orgId),
    ])
    return (leadRes.count ?? 0) > 0 || (demoRes.count ?? 0) > 0
  }

  if (role === 'closer') {
    const [dealRes, demoRes] = await Promise.all([
      service.from('deals').select('id', { count: 'exact', head: true }).eq('closer_id', userId).eq('org_id', orgId),
      service.from('demos').select('id', { count: 'exact', head: true }).eq('closer_id', userId).eq('org_id', orgId),
    ])
    return (dealRes.count ?? 0) > 0 || (demoRes.count ?? 0) > 0
  }

  return false
}
