import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type {
	TrackerSnapshotFingerprint,
	TrackerSnapshotSyncOptions
} from '../TrackerSnapshotAdapter.types';
import { fingerprintTable } from './snapshotFingerprint';

function pendingLink(
	db: SqliteDatabase,
	node: string,
	prefix: '' | 'peer_',
	relayOps: boolean
): TrackerSnapshotFingerprint {
	const metadata = db.prepare('SELECT v FROM main.meta WHERE k = ?');
	const pushed = metadata.get(prefix + 'pushed_seq') as { v: string | null } | undefined;
	const from = Number(pushed?.v ?? 0);
	if (!Number.isSafeInteger(from) || from < 0) throw new Error('Invalid Tracker push cursor');

	const replay = metadata.get(prefix + 'push_all') as { v: string | null } | undefined;
	return fingerprintTable(
		db,
		'ops',
		relayOps || replay?.v === '1'
			? { sql: 'WHERE seq > ?', bindings: [from] }
			: { sql: 'WHERE seq > ? AND node = ?', bindings: [from, node] }
	);
}

export function fingerprintPendingPush(db: SqliteDatabase, options: TrackerSnapshotSyncOptions) {
	const { node, hubRelayOps = false, peerRelayOps } = options;
	return {
		hub: pendingLink(db, node, '', hubRelayOps),
		...(peerRelayOps === undefined ? {} : { peer: pendingLink(db, node, 'peer_', peerRelayOps) })
	};
}
