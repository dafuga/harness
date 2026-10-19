import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import { HistorySyncService, type Synced } from "../services/history-sync-service/HistorySyncService";

export type SyncAction = 'fetch' | 'push' | 'sync';

/** Runs one explicit exchange of evidence, notes and archived source refs with a remote. */
export async function syncHistory(
	action: SyncAction,
	remote = 'origin',
	root = process.cwd()
): Promise<Synced> {
	const absolute = resolve(root);
	const known = await new GitAdapter(absolute).attempt(['remote', 'get-url', remote]);
	if (!known) return fail(`"${remote}" is not a remote of this repository.`);
	return new HistorySyncService(absolute)[action](remote);
}

export function renderSync(action: SyncAction, result: Synced): string {
	const pushed = result.pushed ? 'sent to' : 'nothing sent to';
	const tail = action === 'fetch' ? '' : `; ${pushed} ${result.remote}`;
	return `Evidence ${result.evidence}, notes ${result.notes}${tail}.`;
}
