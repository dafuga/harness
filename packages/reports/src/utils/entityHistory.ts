import { byteSize } from './entityMeasure';

export interface HistoryTiming {
	profile: string;
	workload: string;
	metric: string;
	target: string | null;
	unit: string;
	/** The value of the same profile at the commit listed before; never another profile's. */
	before?: number;
	after: number;
}

const sign = (delta: number) => (delta > 0 ? '+' : '−');

/** A change of size with its direction; nothing when there is no earlier size to compare. */
export function signedBytes(delta: number | null | undefined): string {
	if (delta === null || delta === undefined) return '';
	return delta === 0 ? 'No change' : `${sign(delta)}${byteSize(Math.abs(delta))}`;
}

/** A change of a count with its direction; nothing when there is no earlier count. */
export function signedCount(delta: number | null | undefined): string {
	if (delta === null || delta === undefined) return '';
	return delta === 0 ? 'No change' : `${sign(delta)}${Math.abs(delta)}`;
}

export {
	historyVerdict,
	historyListed,
	entityHistory,
	historyProfiles
} from '../components/harness/entity-history/entityHistory';
export { reviewChanges } from '../components/harness/entity-change/entityHistory';
