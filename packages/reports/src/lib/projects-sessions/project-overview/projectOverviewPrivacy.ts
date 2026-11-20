import type { IncludedTrackerItem, TrackerItemRecord } from './projectOverviewTracker.types';

const REDACTED = '[redacted]';

/** Known credential forms. Each match is replaced by a fixed marker before any text is shown. */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
	/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
	/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
	/\bsk-[A-Za-z0-9_-]{16,}\b/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
	/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
	/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi,
	/\b(password|passwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi
];

/** @pure Replace every known credential form in free text with a fixed marker. */
export function sanitizeText(text: string): string {
	return CREDENTIAL_PATTERNS.reduce((out, pattern) => out.replace(pattern, REDACTED), text);
}

/**
 * @pure Only items that may appear on a card. Deleted and sensitive records are dropped,
 * ignored records never affect a state, and an item with no agent names no project.
 */
export function isIncludedItem(item: TrackerItemRecord): item is IncludedTrackerItem {
	return (
		!item.deleted &&
		!item.sensitive &&
		item.status !== 'ignored' &&
		typeof item.agent === 'string' &&
		item.agent.length > 0
	);
}
