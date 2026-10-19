import { SavedCopy } from '../../utils/cachedSnapshot';
import type { ProjectSnapshot } from '../../models/Desktop.types.ts';

/**
 * A snapshot the phone kept, as the page has to show it: dated, read-only, and with nothing
 * said about what is published. Whatever the computer said about its own cache is replaced.
 */
export function cachedSnapshot(snapshot: ProjectSnapshot, saved: SavedCopy): ProjectSnapshot {
	const { branch, commit } = snapshot.revision;
	const identity = {
		principalId: saved.principal,
		projectId: snapshot.project.id ?? '',
		repositoryId: 0,
		requestedRef: branch,
		sourceCommit: commit,
		sourceTree: '',
		notesRef: null,
		notesRevision: null,
		evidenceRef: null,
		evidenceRevision: null,
		historyIndexRevision: null,
		artifactHash: null,
		profile: null
	};
	return {
		...snapshot,
		writable: false,
		cache: {
			status: 'offline',
			readOnly: true,
			cachedAt: saved.cachedAt,
			publication: 'unknown',
			identity
		}
	};
}
