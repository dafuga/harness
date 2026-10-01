import { expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewCleanCode } from '../src/workflows/reviewCleanCode';
import { cleanCodeExamples } from './support/cleanCodeExamples';
import { reviewSettings, writeReviewFixture } from './support/cleanCodeFixture';

const liveEnabled = process.env.HARNESS_JEV_LIVE_TEST === 'true';

test.skipIf(!liveEnabled).each(cleanCodeExamples)(
	'live naming calibration: $name',
	async (example) => {
		expect(
			process.env.HARNESS_JEV_API_KEY,
			'A dedicated Harness key is required for live calibration'
		).toBeTruthy();
		const root = await mkdtemp(join(tmpdir(), 'harness-jev-live-'));
		try {
			await writeReviewFixture(root, `src/utils/${example.path}`, example.code);
			const started = Date.now();
			const report = await reviewCleanCode({ root, settings: reviewSettings });
			const naming = report.files[0]?.assessments.find(
				(item) => item.principle === 'meaningful-names'
			);
			console.info(
				JSON.stringify({
					example: example.name,
					expected: example.expected,
					actual: naming?.status,
					confidence: naming?.confidence,
					model: report.files[0]?.model,
					status: report.status,
					usage: report.usage,
					latencyMs: Date.now() - started
				})
			);
			expect(report.status).not.toBe('incomplete');
			expect(naming?.status).toBe(example.expected);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	},
	120_000
);
