import { test, vi } from 'vitest';
import type { ResourceJob } from '../../src/core/execution-runtimes/resourceTypes';
import type { ProcessRow } from '../../src/utils/development-tooling/processDescendants';
import {
	abandonedResources,
	resourceIdentity
} from '../../src/utils/execution-runtimes/resourceIdentity';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const table = vi.hoisted(() => ({ rows: null as ProcessRow[] | null }));

vi.mock('../../src/utils/development-tooling/processDescendants', () => ({
	processTable: async () => table.rows
}));

const OWNER_STARTED = 'Sun Nov 15 08:02:11 2026';
const WORKER_STARTED = 'Sun Nov 15 08:02:14 2026';
const OTHER_START = 'Sun Nov 15 07:41:58 2026';
const WORKER_OTHER_START = 'Sun Nov 15 07:42:01 2026';
const NOW = 1794732000000;
const STALE_AT = 1794731940000;
const ROOT = row(1, 'Sun Nov 15 06:00:02 2026', 0);
const ancestry = [ROOT, row(48213, OWNER_STARTED, 1), row(process.pid, WORKER_STARTED, 48213)];

function row(pid: number, started: string, parent: number): ProcessRow {
	return { pid, started, parent, group: pid };
}

function job(over: Partial<ResourceJob>): ResourceJob {
	return {
		id: '6f1c2b9e-3a7d-4e5b-8c10-9d2e4f6a7b81',
		sequence: 41,
		priority: 'coding',
		cpus: 2,
		memoryMiB: 2048,
		label: 'Managed work',
		ownerPid: 48213,
		ownerStarted: OWNER_STARTED,
		workerPid: 48977,
		workerStarted: WORKER_STARTED,
		state: 'running',
		createdAt: 1794729734000,
		heartbeatAt: 1794731995000,
		notice: null,
		...over
	};
}

async function identityWith(
	rows: ProcessRow[] | null,
	over: Partial<ResourceJob>
): Promise<boolean> {
	table.rows = rows;
	return resourceIdentity(job(over));
}

test('Resource identity accepts a matching ancestor owner', async () => {
	const spacedStart = 'Sun  Nov 15 08:02:11 2026';
	const accepted = await identityWith(ancestry, {});
	const collapsed = await identityWith(ancestry, { ownerStarted: spacedStart });
	expect([accepted, collapsed]).toEqual([true, true]);
	recordExampleCases(
		{
			unitId: 'function.resource-identity',
			symbol: 'resourceIdentity',
			state: 'resource-identity-accepts-a-matching-ancestor-owner',
			evidence: 'examples-cases',
			file: 'resource-identity-accepts-a-matching-ancestor-owner.json'
		},
		[
			{
				name: 'owner pid is the parent of this process',
				input: { ownerPid: 48213, ownerStarted: OWNER_STARTED },
				output: accepted
			},
			{
				name: 'owner start differs only in whitespace runs',
				input: { ownerPid: 48213, ownerStarted: spacedStart },
				output: collapsed
			}
		]
	);
});

test('Resource identity rejects reused or unrelated owners', async () => {
	const unrelated = [
		ROOT,
		row(47102, OTHER_START, 1),
		row(48213, OWNER_STARTED, 1),
		row(process.pid, WORKER_STARTED, 48213)
	];
	const reused = await identityWith(ancestry, { ownerStarted: OTHER_START });
	const notAncestor = await identityWith(unrelated, { ownerPid: 47102, ownerStarted: OTHER_START });
	const missingOwner = await identityWith([ROOT, row(process.pid, WORKER_STARTED, 1)], {});
	const unreadable = await identityWith(null, {});
	expect([reused, notAncestor, missingOwner, unreadable]).toEqual([false, false, false, false]);
	recordExampleCases(
		{
			unitId: 'function.resource-identity',
			symbol: 'resourceIdentity',
			state: 'resource-identity-rejects-reused-or-unrelated-owners',
			evidence: 'examples-cases',
			file: 'resource-identity-rejects-reused-or-unrelated-owners.json'
		},
		[
			{
				name: 'owner pid reused with another start time',
				input: { ownerPid: 48213, ownerStarted: OTHER_START },
				output: reused
			},
			{
				name: 'owner exists but is not an ancestor',
				input: { ownerPid: 47102, ownerStarted: OTHER_START },
				output: notAncestor
			},
			{
				name: 'owner pid absent from the process table',
				input: { ownerPid: 48213, ownerStarted: OWNER_STARTED, table: 'no owner row' },
				output: missingOwner
			},
			{
				name: 'process table is unreadable',
				input: { ownerPid: 48213, ownerStarted: OWNER_STARTED, table: 'unreadable' },
				output: unreadable
			}
		]
	);
});

test('Abandoned resources flags stale leases with no live owner', () => {
	const stale = job({
		id: '0d9a7e15-c4b2-4f83-a6e1-5b7c9d2f8a40',
		ownerPid: 47102,
		ownerStarted: OTHER_START,
		workerPid: 47155,
		workerStarted: WORKER_OTHER_START,
		heartbeatAt: STALE_AT
	});
	const fresh = job({ id: 'fresh-lease-0001', heartbeatAt: 1794731995000 });
	const owned = job({ id: 'owned-lease-0002', heartbeatAt: 1794731990000 });
	const abandoned = abandonedResources([stale, fresh], [ROOT], NOW);
	const kept = abandonedResources([owned], ancestry, NOW + 30000);
	const none = abandonedResources([], ancestry, NOW);
	expect([abandoned, kept, none]).toEqual([['0d9a7e15-c4b2-4f83-a6e1-5b7c9d2f8a40'], [], []]);
	recordExampleCases(
		{
			unitId: 'function.resource-identity',
			symbol: 'abandonedResources',
			state: 'abandoned-resources-flags-stale-leases-with-no-live-owner',
			evidence: 'examples-cases',
			file: 'abandoned-resources-flags-stale-leases-with-no-live-owner.json'
		},
		[
			{
				name: 'stale lease whose owner and worker are absent',
				input: { ids: [stale.id, fresh.id], now: NOW, rows: [1] },
				output: abandoned
			},
			{
				name: 'stale lease whose owner is still running',
				input: { ids: [owned.id], now: NOW + 30000, rows: [1, 48213, 48977] },
				output: kept
			},
			{
				name: 'no leases to examine',
				input: { ids: [], now: NOW, rows: [1, 48213, 48977] },
				output: none
			}
		]
	);
});

test('Abandoned resources matches workers by pid and start time', () => {
	const startMismatch = job({
		id: 'worker-start-mismatch',
		ownerPid: 47102,
		ownerStarted: OTHER_START,
		workerPid: 48977,
		workerStarted: WORKER_OTHER_START,
		heartbeatAt: STALE_AT
	});
	const pidOnly = job({
		id: 'worker-pid-only',
		ownerPid: 47102,
		ownerStarted: OTHER_START,
		workerPid: 47155,
		heartbeatAt: STALE_AT
	});
	delete pidOnly.workerStarted;
	const rows = [ROOT, row(48977, WORKER_STARTED, 1), row(47155, WORKER_OTHER_START, 1)];
	const result = abandonedResources([startMismatch, pidOnly], rows, NOW);
	expect(result).toEqual(['worker-start-mismatch']);
	recordExampleCases(
		{
			unitId: 'function.resource-identity',
			symbol: 'abandonedResources',
			state: 'abandoned-resources-matches-workers-by-pid-and-start-time',
			evidence: 'examples-cases',
			file: 'abandoned-resources-matches-workers-by-pid-and-start-time.json'
		},
		[
			{
				name: 'worker pid present but with another start time',
				input: { id: startMismatch.id, workerPid: 48977, workerStarted: WORKER_OTHER_START },
				output: ['worker-start-mismatch']
			},
			{
				name: 'worker without workerStarted matches on pid alone',
				input: { id: pidOnly.id, workerPid: 47155, workerStarted: null },
				output: []
			}
		]
	);
});
