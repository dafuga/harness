// @harness-uid u_bujko2d2cj
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerRecurringJobReceipt } from '../../../services/projects-sessions/TrackerRecurringService.types';

export function trackerJobStateDirectory(directory: string, itemId: string): string {
	return join(directory, 'state', safeName(itemId));
}

/** One private receipt per item. Only one occurrence per item can be claimed at a time. */
export function trackerJobReceipts(directory: string) {
	const folder = join(directory, 'receipts');
	const path = (itemId: string) => join(folder, safeName(itemId) + '.json');
	return {
		write(itemId: string, identity: string, receipt: TrackerRecurringJobReceipt) {
			mkdirSync(folder, { recursive: true, mode: 0o700 });
			const pending = path(itemId) + '.tmp';
			writeFileSync(pending, JSON.stringify({ identity, receipt }), { mode: 0o600 });
			renameSync(pending, path(itemId));
		},
		read(itemId: string, identity: string): TrackerRecurringJobReceipt | undefined {
			try {
				const stored = JSON.parse(readFileSync(path(itemId), 'utf8')) as {
					identity: string;
					receipt: TrackerRecurringJobReceipt;
				};
				return stored.identity === identity ? stored.receipt : undefined;
			} catch (error) {
				if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
				throw error;
			}
		}
	};
}

function safeName(itemId: string): string {
	if (!/^[A-Za-z0-9_-]+$/.test(itemId)) throw new TypeError('Unsafe Tracker job item id');
	return itemId;
}
