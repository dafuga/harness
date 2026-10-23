/**
 * What each revision of the made-up history holds to search, as a host hands it to the bar: the
 * newer commits of the branch hold a shell and a totals function, the older ones a legacy one.
 */
export type Row = [id: string, category: string, name: string, purpose: string, terms?: string[]];
