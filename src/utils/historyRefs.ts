import {
	evidenceRef,
	notesRef,
	remoteTrackingPrefix,
	sourceArchivePrefix
} from '../core/historyTypes';

export type RefKind =
	| 'source'
	| 'evidence'
	| 'notes'
	| 'archive'
	| 'internal'
	| 'tag'
	| 'remote'
	| 'other';

/** The ref that keeps one tested commit reachable after its branch is deleted or rewritten. */
export function sourceArchiveRef(commit: string): string {
	return `${sourceArchivePrefix}${commit}`;
}

const prefixes: Array<[string, RefKind]> = [
	[sourceArchivePrefix, 'archive'],
	[remoteTrackingPrefix, 'internal'],
	['refs/harness/', 'internal'],
	['refs/notes/', 'notes'],
	['refs/tags/', 'tag'],
	['refs/remotes/', 'remote'],
	['refs/heads/', 'source']
];

/**
 * What a ref holds. Only `source` refs are branches of code: evidence, notes and archived
 * source are history about code and never start a verification or count as a change.
 */
export function refKind(ref: string): RefKind {
	if (ref === evidenceRef) return 'evidence';
	if (ref === notesRef) return 'notes';
	return prefixes.find(([prefix]) => ref.startsWith(prefix))?.[1] ?? 'other';
}

export { historyRefs } from '../services/history-sync-service/historyRefs';
