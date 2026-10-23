import { byteSize } from './entityMeasure';

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
} from '../../components/explorer-ui/entity-history/entityHistory';
export { reviewChanges } from '../../components/explorer-ui/entity-change/entityHistory';

export type { HistoryTiming } from './entityHistory.types';
