// Fetch ALL rows from a Supabase/PostgREST query, transparently paging past the
// server's max-rows cap (Supabase default = 1000). Without this, an unbounded
// `.select()` silently returns only the first ~1000 rows — so large lead lists,
// exports, and counts come back truncated.
//
// `makeQuery(from, to)` must return a query with `.range(from, to)` applied AND a
// STABLE `.order()` that ends in a unique tiebreaker (e.g. `id`), so consecutive
// pages never overlap or skip a row when the primary sort has ties.
export async function fetchAllRows<T = any>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  // Safety bound (200 pages × 1000 = 200k rows) guards against an unexpected loop.
  for (let page = 0; page < 200; page++) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message ?? 'fetchAllRows failed')
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break // partial page → end of data
    from += pageSize
  }
  return all
}
