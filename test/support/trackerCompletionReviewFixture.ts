import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { onTestFinished, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../src/repositories/projects-sessions/TrackerRunReadRepository';
import * as launchEligibility from '../../src/services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { idleHostResources } from './trackerHostResourceFixture';
import { managedFixtureBindings } from './trackerManagedProcessFixture';
import type { TemporaryRepo } from './temporary.types';
import type { ReviewFixture } from './trackerCompletionReviewFixture.types';

export const reviewNode = 'daniel-primary-mbp';
export const reviewItem = 'abc123def4';
const client = { node: reviewNode, role: 'hub' as const, apiPort: 49281, syncPort: 49282 };

/** A real runtime and managed macOS launcher over a fake tmux and provider. */
export function completionReviewFixture({ root, git }: TemporaryRepo, verify?: string) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const { config } = managedFixtureBindings(root);
	const database = new DatabaseSync(':memory:');
	const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
	const lifetimes: AbortController[] = [];
	// Automatic retries run on the real clock here; the 22:00-08:00 Lisbon launch hold would stall them.
	const dayHours = vi.spyOn(launchEligibility, 'automaticQuietHour').mockReturnValue(false);
	onTestFinished(() => {
		for (const lifetime of lifetimes) lifetime.abort();
		database.close();
		dayHours.mockRestore();
	});
	const boot = () => {
		const lifetime = new AbortController();
		lifetimes.push(lifetime);
		Object.defineProperty(process, 'platform', { ...platform, value: 'darwin' });
		try {
			const runtime = new TrackerNativeRuntimeService(database, {
				node: reviewNode,
				role: 'hub',
				hostEffects: {
					workerClient: client,
					hostResources: idleHostResources(),
					launch: {
						managed: config,
						due: false,
						repositories: { harness: { repo: root, platform: 'macos', verify } }
					}
				}
			});
			const tick = () => runtime.scheduler!.tick(lifetime.signal);
			return { runtime, tick, stop: () => lifetime.abort() };
		} finally {
			Object.defineProperty(process, 'platform', platform);
		}
	};
	return { root, database, boot, ...reviewReads(root, database), ...boot() };
}

function reviewReads(root: string, database: DatabaseSync) {
	const items = new TrackerItemReadRepository(database);
	const runs = new TrackerRunReadRepository(database, reviewNode);
	const file = (name: string) => join(root, name);
	return {
		item: (id = reviewItem) => items.get(id),
		runs: (id = reviewItem) => runs.list({ itemId: id }).sort((a, b) => a.id - b.id),
		notes: (id = reviewItem) => JSON.stringify(items.get(id)),
		exists: (name: string) => existsSync(file(name)),
		read: (name: string) => (existsSync(file(name)) ? readFileSync(file(name), 'utf8') : ''),
		touch: (name: string) => writeFileSync(file(name), 'yes')
	};
}

export function addReviewItem(fixture: ReviewFixture, id = reviewItem) {
	fixture.runtime.store.appendLocal({
		itemId: id,
		fields: {
			title: 'Fix the fixture parser',
			kind: 'task',
			status: 'open',
			project: 'harness',
			computer: reviewNode,
			model: 'gpt-6.2-sol'
		}
	});
}

/** Request a manual launch and reconcile until its provider session is running. */
export async function startReviewRun(fixture: ReviewFixture, tick = fixture.tick) {
	addReviewItem(fixture);
	await fixture.runtime.dispatch!.request(reviewItem, { source: 'manual', token: 'review-token' });
	await tick();
	await vi.waitFor(() => {
		if (fixture.runs()[0]?.state !== 'running') throw new Error('run has not started');
	});
}

export function markReviewDone(fixture: ReviewFixture, id = reviewItem) {
	fixture.runtime.store.appendLocal({ itemId: id, fields: { status: 'done' } });
}

export function tickUntil(tick: () => Promise<void>, check: () => void) {
	return vi.waitFor(
		async () => {
			await tick();
			check();
		},
		{ timeout: 15_000, interval: 50 }
	);
}

export function reviewRequest(
	runtime: TrackerNativeRuntimeService,
	id: string,
	action: string,
	body: Record<string, string> = {}
) {
	return runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${id}/${action}`, {
			method: 'POST',
			body: JSON.stringify(body)
		})
	);
}
