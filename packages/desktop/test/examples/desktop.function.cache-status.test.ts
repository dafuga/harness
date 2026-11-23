import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	everyProject,
	deniedNotice,
	offlineNotice,
	offlineCapabilities,
	forgetShared,
	cacheStatus
} from '../../src/utils/projects-sessions/cache-status/cacheStatus';
import type { OfflineView } from '../../src/utils/projects-sessions/cache-status/cacheStatus.types';
import { offlineView } from '../../src/utils/projects-sessions/load-workspace/offlineView';

const state = (title: string) =>
	title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
const snapshot = () => ({ writable: true, cache: { status: 'fresh' } });
const workspace = (source: 'local' | 'github' = 'github') => ({
	projects: [
		{ id: 'shared-1', kind: 'shared' },
		{ id: 'local-1', kind: 'local' }
	],
	target: 'shared-1',
	projectId: 'shared-1',
	capabilities: { source, comments: true, agents: true, planning: true, approval: true },
	snapshot: snapshot(),
	entity: { id: 'entity-1' },
	offline: null,
	error: null,
	invalidations: 0,
	loads: 0,
	invalidate() {
		this.invalidations += 1;
	},
	loadProjects() {
		this.loads += 1;
	}
});
const viewOf = (value: unknown) => offlineView(value as Parameters<typeof offlineView>[0]);

test('makes the shown snapshot read only while offline', () => {
	const current = workspace();
	cacheStatus(current as unknown as Parameters<typeof cacheStatus>[0], {
		projectId: 'shared-1',
		status: 'offline',
		cachedAt: '2026-11-14T09:30:00.000Z'
	});
	expect(current.snapshot?.writable).toBe(false);
	expect(current.capabilities).toMatchObject({
		comments: false,
		source: 'github',
		reason: offlineNotice
	});
	expect(viewOf({ cache: current.snapshot?.cache })).toEqual({
		cachedAt: '2026-11-14T09:30:00.000Z'
	} satisfies OfflineView);
	recordExampleCases(
		{
			unitId: 'desktop.function.cache-status',
			symbol: 'cacheStatus',
			state: state('Makes the shown snapshot read only while offline'),
			evidence: 'examples-cases',
			file: `${state('Makes the shown snapshot read only while offline')}.json`
		},
		[
			{
				name: 'matching project enters cached mode',
				input: { projectId: 'shared-1', status: 'offline', cachedAt: '2026-11-14T09:30:00.000Z' },
				output: {
					writable: current.snapshot?.writable,
					capabilities: current.capabilities,
					offline: current.offline,
					cache: current.snapshot?.cache
				}
			}
		]
	);
});

test('clears a denied shared project and whole session access', () => {
	const named = workspace();
	forgetShared(named as unknown as Parameters<typeof cacheStatus>[0], 'shared-1', deniedNotice);
	const whole = workspace();
	forgetShared(whole as unknown as Parameters<typeof cacheStatus>[0], everyProject, deniedNotice);
	expect(named.snapshot).toBeNull();
	expect(named.error).toBe(deniedNotice);
	expect(whole.projects).toEqual([{ id: 'local-1', kind: 'local' }]);
	recordExampleCases(
		{
			unitId: 'desktop.function.cache-status',
			symbol: 'forgetShared',
			state: state('Clears a denied shared project and whole session access'),
			evidence: 'examples-cases',
			file: `${state('Clears a denied shared project and whole session access')}.json`
		},
		[
			{
				name: 'named denial clears the shown project',
				input: { projectId: 'shared-1' },
				output: {
					snapshot: named.snapshot,
					error: named.error,
					targetInvalidations: named.invalidations,
					projectRefreshes: named.loads
				}
			},
			{
				name: 'whole-session denial retains local projects',
				input: { projectId: everyProject },
				output: { projects: whole.projects, snapshot: whole.snapshot }
			}
		]
	);
});

test('reports cached snapshot time and disables offline capabilities', () => {
	const dated = viewOf({ cache: { status: 'offline', cachedAt: '2026-11-14T09:30:00.000Z' } });
	const undated = viewOf({ cache: { readOnly: true } });
	const current = offlineCapabilities('local');
	expect(dated).toEqual({ cachedAt: '2026-11-14T09:30:00.000Z' });
	expect(undated).toEqual({ cachedAt: null });
	expect(current).toMatchObject({
		comments: false,
		agents: false,
		planning: false,
		approval: false,
		source: 'local',
		reason: offlineNotice
	});
	recordExampleCases(
		{
			unitId: 'desktop.function.cache-status',
			symbol: 'offlineView',
			state: state('Reports cached snapshot time and disables offline capabilities'),
			evidence: 'examples-cases',
			file: `${state('Reports cached snapshot time and disables offline capabilities')}.json`
		},
		[
			{
				name: 'offline cache reports its timestamp',
				input: { cache: { status: 'offline', cachedAt: '2026-11-14T09:30:00.000Z' } },
				output: dated
			},
			{
				name: 'read-only cache without timestamp reports null time',
				input: { cache: { readOnly: true } },
				output: undated
			},
			{ name: 'local offline capabilities are closed', input: { source: 'local' }, output: current }
		]
	);
});
