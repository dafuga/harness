import { expect, test } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { trackerRunRecords } from '../../../src/services/agents-providers/module-task-analytics-service/trackerRunRecords';
import type { TrackerRunRow } from '../../../src/utils/agents-providers/trackerRunReport.types';

const recorded = {
	node: 'synthetic-local',
	id: 7,
	item_id: 'item-1',
	auto_token: 'synthetic-launch-a',
	rung: 'haiku',
	model: 'claude-haiku-5-5',
	cli: 'claude',
	effort: 'high',
	kind: 'feature',
	project: 'Harness',
	attempt: 1,
	state: 'finished',
	outcome: 'rejected',
	started_at: 1_000,
	ended_at: 2_000,
	input_tokens: 100,
	output_tokens: 20,
	cache_read_tokens: 15,
	cache_write_tokens: 5,
	cost_usd: 0.002
} satisfies TrackerRunRow;

test('preserves linked attempts, rework, and the meaning of historical Tracker pricing', () =>
	measureWorkload(
		'service.agents-providers-module-task-analytics-service-tracker-run-records',
		'linked-attempt-cost-provenance',
		() => {
			const [first, second, third] = linkedAttempts();
			expect(first).toMatchObject({
				schemaVersion: 1,
				source: 'tracker',
				taskId: 'item-1',
				id: '["synthetic-local",7]',
				attempt: 1,
				retries: 0,
				escalations: 0,
				firstTry: false,
				outcome: 'rejected',
				inputTokens: 120,
				cacheReadTokens: 15,
				cacheWriteTokens: 5,
				wallTimeMs: 1_000,
				apiEquivalentUsd: 0.002,
				apiEquivalentMinUsd: 0.002,
				apiEquivalentMaxUsd: 0.002,
				apiEquivalentBasis: 'standard-api-estimate',
				rateCard: 'tracker-legacy-flat',
				actualUsd: null,
				codexCredits: null
			});
			expect(second).toMatchObject({
				chainId: first.chainId,
				attempt: 2,
				retries: 1,
				escalations: 1,
				rejectedBefore: true,
				reworked: true,
				danielCorrections: null,
				apiEquivalentUsd: 0.0004015,
				apiEquivalentBasis: 'standard-api-estimate',
				rateCard: 'standard-global-2026-11-19',
				actualUsd: null,
				codexCredits: null
			});
			expect(third).toMatchObject({ attempt: 3, retries: 2, escalations: 1, apiEquivalentUsd: 0 });
		}
	));

function linkedAttempts() {
	const retry = {
		...recorded,
		id: 8,
		attempt: 2,
		escalated_from: 7,
		outcome: 'done',
		rung: 'sol',
		model: 'gpt-6.2-sol',
		cli: 'codex',
		cache_write_tokens: 0,
		cost_usd: null
	} satisfies TrackerRunRow;
	const sameModel = { ...retry, id: 9, attempt: 3, escalated_from: 8, cost_usd: 0 };
	return trackerRunRecords([recorded, retry, sameModel]);
}

test('retains node-scoped identities, launch chains, and historically missing facts', () => {
	const remote = {
		...recorded,
		node: 'synthetic-remote',
		id: 7,
		auto_token: 'synthetic-launch-b',
		outcome: 'done',
		attempt: null,
		started_at: null,
		cache_read_tokens: null,
		cost_usd: null
	} satisfies TrackerRunRow;
	const incomplete = { ...remote, id: 8, attempt: 2, escalated_from: 6 };
	const [local, separate, partial] = trackerRunRecords([
		recorded,
		remote,
		incomplete,
		{ ...recorded, state: 'running' },
		{ ...recorded, ended_at: null }
	]);
	expect(separate.id).not.toBe(local.id);
	expect(separate.chainId).not.toBe(local.chainId);
	expect(separate).toMatchObject({
		attempt: null,
		retries: null,
		escalations: null,
		rejectedBefore: null,
		firstTry: false,
		startedAt: null,
		wallTimeMs: null,
		inputTokens: null,
		apiEquivalentUsd: null
	});
	expect(partial).toMatchObject({
		attempt: 2,
		retries: 1,
		escalations: null,
		rejectedBefore: null
	});
	expect(trackerRunRecords([{ ...recorded, outcome: 'done' }])[0]).toMatchObject({
		firstTry: true,
		rejectedBefore: false
	});
});
