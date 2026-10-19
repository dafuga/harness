import { expect, test } from 'vitest';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';
import { offlineView } from '../../src/utils/load-workspace/cacheStatus';
import { cachedSnapshot } from '../../src/adapters/capacitor-bridge-adapter/cachedSnapshot';

const tip = 'a'.repeat(40);
const cachedAt = '2026-10-12T07:30:00.000Z';
const principal = 'd'.repeat(40);
const snapshot = (): ProjectSnapshot => ({
	project: { id: 'local-1', name: 'One', root: '' },
	capabilities: { comments: true, agents: true, planning: true, approval: true, source: 'local' },
	revision: { branch: 'main', commit: tip, tip, atTip: true },
	branches: [],
	commits: [],
	entities: [],
	writable: true
});

test('a saved snapshot is dated, read-only and claims nothing about what is published', () => {
	const live = snapshot();
	const cached = cachedSnapshot(live, { cachedAt, principal });
	expect(cached.writable).toBe(false);
	expect(cached.cache).toMatchObject({
		status: 'offline',
		readOnly: true,
		cachedAt,
		publication: 'unknown'
	});
	expect(cached.cache?.identity).toMatchObject({
		principalId: principal,
		projectId: 'local-1',
		requestedRef: 'main',
		sourceCommit: tip
	});
	expect(offlineView(cached)).toEqual({ cachedAt });
	expect(live.writable).toBe(true);
	expect(live.cache).toBeUndefined();
});

test('what a computer said about its own cache does not make a saved copy current', () => {
	const live = snapshot();
	live.cache = { status: 'fresh', publication: 'remote', identity: {} as never };
	const cached = cachedSnapshot(live, { cachedAt, principal });
	expect(cached.cache).toMatchObject({ status: 'offline', readOnly: true, publication: 'unknown' });
});
