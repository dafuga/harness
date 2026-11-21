import { statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerAdapterLeaseAdapter } from '../../../src/adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { withTempDir } from '../../support/temporary';

test('uses the legacy SQLite lock inode and releases it for the previous owner', () =>
	withTempDir('harness-adapter-lock-', (directory) => {
		const path = join(directory, 'adapter-runner.lock');
		const candidate = new TrackerAdapterLeaseAdapter('fixture-owner', path);
		const legacy = new DatabaseSync(path);
		try {
			legacy.exec('BEGIN EXCLUSIVE');
			expect(candidate.tryAcquire()).toBeNull();
			legacy.exec('ROLLBACK');
			const release = candidate.tryAcquire();
			if (!release) throw new Error('Fixture candidate did not acquire the lease');
			try {
				expect(candidate.tryAcquire()).toBeNull();
				expect(() => legacy.exec('BEGIN EXCLUSIVE')).toThrow(/locked/);
				expect(statSync(path).mode & 0o777).toBe(0o600);
			} finally {
				release();
				release();
			}
			legacy.exec('BEGIN EXCLUSIVE');
		} finally {
			legacy.close();
		}
	}));
