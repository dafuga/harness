import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as gathering from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/gatherCaptures';
import { withTempRepo } from './support/temporary';
import { gatherVideoReferenceFixture } from './support/gatherVideoReferenceFixture';
import { RecordBudget } from '../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/captureLimits';
import { scenarioCoverage } from '../src/workflows/verification-evidence/run-verify/verification-service/scenarioCoverage';

test('verified child references bypass only parent media budget and preserve original source stamps', async () => {
	expect(typeof gathering.gatherVerificationCaptures).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await gatherVideoReferenceFixture(repo),
			budget = new RecordBudget(1);
		const result = await gathering.gatherVerificationCaptures(
			f.directory,
			'current/check',
			{},
			{ budget, root: repo.root, video: f.context }
		);
		expect(result.failures).toEqual([]);
		expect(result.videoBatches).toEqual(f.pointers);
		expect(result.gathered[0].capture).toEqual(f.capture);
		expect(budget.remaining()).toBe(1);
		expect(existsSync(join(f.directory, 'clip.mp4'))).toBe(false);
		const input = {
			scenario: f.scenario,
			commit: f.context.source.commit,
			gathered: result.gathered,
			checkFailed: false,
			videoSlots: f.context.slots,
			builds: { declared: ['preview'], compiled: new Map([['preview', 'new-compiled-build']]) }
		};
		expect(scenarioCoverage(input).failures).toEqual([]);
		expect(
			scenarioCoverage({
				...input,
				gathered: globalThis.structuredClone(result.gathered)
			}).failures.join(' ')
		).toMatch(/revision|build/);
		result.gathered[0].capture.server!.buildId = 'c'.repeat(64);
		expect(scenarioCoverage(input).failures.join(' ')).toMatch(/revision|build/);
	});
}, 30_000);

test('serialized references require matching current inputs and an intact original attached parent', async () => {
	expect(typeof gathering.gatherVerificationCaptures).toBe('function');
	await withTempRepo(async (repo) => {
		const f = await gatherVideoReferenceFixture(repo),
			budget = new RecordBudget(1);
		const gather = (video = f.context) =>
			gathering.gatherVerificationCaptures(
				f.directory,
				'current/check',
				{},
				{ budget, root: repo.root, video }
			);
		const stale = await gather({
			...f.context,
			slots: [{ ...f.context.slots[0], inputHash: '0'.repeat(64) }]
		});
		expect(stale.gathered).toEqual([]);
		expect(stale.failures.join(' ')).toMatch(/current snapshot/);
		f.write({
			...f.capture,
			videoReference: { ...f.capture.videoReference, record: '0'.repeat(64) }
		});
		const forged = await gather();
		expect(forged.gathered).toEqual([]);
		expect(forged.failures.join(' ')).toMatch(/original|attach|parent|record/i);
		expect(budget.remaining()).toBe(1);
		const unbound = await gathering.gatherVerificationCaptures(f.directory, 'current/check');
		expect(unbound.failures.join(' ')).toMatch(/independent snapshot/);
	});
}, 30_000);
