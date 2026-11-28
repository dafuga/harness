import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RecordedTracker } from './recordedTracker.types';
export type { RecordedTracker } from './recordedTracker.types';

/**
 * A real Tracker reading of 2026-11-26 with every name and free text replaced: 49 items and 79
 * runs, 17 of them live on two computers. Each call returns a copy a test may change.
 */
export function recordedTracker(): RecordedTracker {
	const file = resolve(import.meta.dirname, 'recordedTracker.json');
	return JSON.parse(readFileSync(file, 'utf8')) as RecordedTracker;
}

/** The three Tracker reads the Mac issues, answered from a recording. */
export function recordedTrackerFetch(tracker: RecordedTracker): typeof fetch {
	return (async (target: string | Request | URL) => {
		const path = new URL(String(target)).pathname;
		if (path === '/items') return Response.json(tracker.items);
		if (path === '/runs') return Response.json(tracker.runs);
		if (path === '/machines') return Response.json(tracker.machines);
		throw new Error(`unexpected Tracker read: ${path}`);
	}) as typeof fetch;
}

export const expectedComputerOrder = [
	'daniel-primary-mbp',
	'alpha-runner',
	'harbor-mbp-2',
	'studio-mac',
	'travel-mac',
	'grok-box'
];

/** Two live origin runs delegate work to the same computer. */
export function seedComputerWork(tracker: RecordedTracker) {
	const running = tracker.runs.filter((run) => run.state === 'running').slice(0, 2);
	tracker.machines.push(
		{ node: 'studio-mac', status: 'busy' },
		{ node: 'grok-box', status: 'offline' },
		{ node: 'travel-mac', status: 'ok' },
		{
			node: 'harbor-mbp-2',
			status: 'overloaded',
			reasons: ['memory pressure is critical'],
			remote_runs: 2,
			remote_run_refs: running.map(({ node, id }) => ({ node, id })),
			cores: 10,
			load: [3.5, 3, 2],
			ram: { available_mb: 12288, total_mb: 65536 },
			disks: [{ mount: '/', free_gb: 45.5 }]
		},
		{ node: 'alpha-runner', status: 'ok' },
		{ node: 'daniel-primary-mbp', status: 'ok' }
	);
	return running.map((run) => tracker.items.find((item) => item.id === run.item_id)!.title);
}
