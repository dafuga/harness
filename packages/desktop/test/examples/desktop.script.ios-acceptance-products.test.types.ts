import type { acceptanceProducts, normalProduct } from '../../scripts/ios-acceptance-products';

export type RecordLike = Parameters<typeof acceptanceProducts>[0];

export type ReadLike = Parameters<typeof acceptanceProducts>[1];

export type AcceptanceLike = Parameters<typeof normalProduct>[0];

export interface Ledger {
	begun: string[];
	checks: Array<[boolean, string]>;
}
