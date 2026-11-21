// @harness-uid u_e7x5dhawh4
import { realpathSync } from 'node:fs';
import { TrackerAdapterLeaseAdapter } from '../../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import type { TrackerNotificationQueue } from '../../../services/projects-sessions/TrackerNotificationService.types';

const fileTails = new Map<string, Promise<unknown>>();
const memoryTails = new WeakMap<SqliteDatabase, Promise<unknown>>();

function databasePath(database: SqliteDatabase): string | undefined {
	const rows = database.prepare('PRAGMA database_list').all() as { name: string; file: string }[];
	const file = rows.find(({ name }) => name === 'main')?.file;
	return file ? realpathSync(file) : undefined;
}

function queueWork<Key>(
	tails: Pick<Map<Key, Promise<unknown>>, 'get' | 'delete'> & {
		set(key: Key, value: Promise<unknown>): void;
	},
	key: Key
): TrackerNotificationQueue['exclusive'] {
	return (work) => {
		const tail = tails.get(key) ?? Promise.resolve();
		const next = tail.then(work);
		const settled = next.catch(() => undefined);
		tails.set(key, settled);
		void settled.then(() => {
			if (tails.get(key) === settled) tails.delete(key);
		});
		return next;
	};
}

export function notificationExclusivity(
	database: SqliteDatabase
): TrackerNotificationQueue['exclusive'] {
	const path = databasePath(database);
	if (!path) return queueWork(memoryTails, database);
	const queue = queueWork(fileTails, path);
	const lease = new TrackerAdapterLeaseAdapter(
		'native-notifications',
		`${path}.harness-notifications.lock`
	);
	return (work) =>
		queue(async () => {
			const release = lease.tryAcquire();
			if (!release) throw new Error('Tracker notification queue is busy');
			try {
				return await work();
			} finally {
				release();
			}
		});
}
