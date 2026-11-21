// @harness-uid u_7xh35kvg5l
import { closeSync, constants, fchmodSync, fstatSync, openSync } from 'node:fs';
import type { TrackerAdapterLease } from '../../services/projects-sessions/TrackerAdapterPollService.types';
import { openSqlite } from '../development-tooling/openSqlite';
import { TrackerAdapterLeaseError } from './tracker-adapter-lease-adapter/TrackerAdapterLeaseError';

/** Shares the pinned Tracker adapter runner's SQLite lock file across processes. */
export class TrackerAdapterLeaseAdapter implements TrackerAdapterLease {
	constructor(
		readonly owner: string,
		private readonly path: string
	) {}

	tryAcquire(): (() => void) | null {
		return tryAcquireTrackerSqliteLease(this.path);
	}
}

/** A private SQLite writer lock released by closing the connection or exiting the process. */
export function tryAcquireTrackerSqliteLease(path: string): (() => void) | null {
	prepareLockFile(path);
	const lock = openSqlite(path);
	try {
		lock.exec('PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE');
	} catch (error) {
		lock.close();
		if (leaseBusy(error)) return null;
		throw new TrackerAdapterLeaseError('Could not acquire the Tracker SQLite lease');
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		lock.close();
	};
}

function prepareLockFile(path: string): void {
	const { O_CREAT, O_NOFOLLOW, O_RDWR } = constants;
	const fd = openSync(path, O_CREAT | O_NOFOLLOW | O_RDWR, 0o600);
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.nlink !== 1) {
			throw new TrackerAdapterLeaseError('Invalid Tracker SQLite lock file');
		}
		if (stat.mode & 0o077) fchmodSync(fd, 0o600);
	} finally {
		closeSync(fd);
	}
}

function leaseBusy(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	if ('code' in error && /^SQLITE_(BUSY|LOCKED)(_|$)/.test(String(error.code))) return true;
	return 'errcode' in error && [5, 6].includes(Number(error.errcode) & 255);
}
