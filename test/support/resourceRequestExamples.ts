import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { ResourceJob } from '../../src/core/execution-runtimes/resourceTypes';
import { resourceRequest } from '../../src/utils/execution-runtimes/resourceRequest';
import { job, observeResources, snapshot } from './resourceFixture';
import type {
	ResourceRequestExampleFixture,
	ResourceRequestQueueFixture,
	ResourceRequestRejection
} from './resourceRequestExamples.types';

/** Each example gets a disposable config home, synthetic telemetry and a synthetic queue. */
export async function invokeResourceRequest(
	input: ResourceRequestExampleFixture
): Promise<unknown> {
	const finish = observeResources(['function.resource-request'], 'resource-request-examples');
	const home = mkdtempSync(join(tmpdir(), 'resource-sizing-'));
	try {
		const jobs = queueJobs(input.queue ?? []);
		const service = {
			home,
			snapshot: async () => snapshot(input.telemetry),
			queue: { all: () => jobs }
		};
		const pending = resourceRequest(input.flags, service, input.env ?? {});
		const result = input.outcome === 'rejection' ? await rejection(pending) : await pending;
		finish();
		return result;
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}

function queueJobs(entries: ResourceRequestQueueFixture[]): ResourceJob[] {
	const jobs = new Map<string, ResourceJob>();
	for (const entry of entries) {
		const parent = entry.parent === undefined ? undefined : jobs.get(entry.parent);
		if (entry.parent !== undefined && !parent)
			throw new Error(`Unknown queue parent: ${entry.parent}`);
		jobs.set(
			entry.name,
			job({
				state: entry.state,
				cpus: entry.cpus,
				...(parent ? { parentId: parent.id } : {})
			})
		);
	}
	return [...jobs.values()];
}

async function rejection(pending: Promise<unknown>): Promise<ResourceRequestRejection> {
	const error: unknown = await pending.then(() => undefined, (caught: unknown) => caught);
	expect(error, 'malformed resource request must reject').toBeInstanceOf(Error);
	const { name, issues = [] } = error as Error & { issues?: Array<{ path: PropertyKey[] }> };
	return { name, issuePaths: issues.map((issue) => issue.path) };
}
