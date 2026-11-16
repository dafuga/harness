import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { JobHistoryRepository } from '../../src/repositories/execution-runtimes/JobHistoryRepository';
import { JobBackfillService } from '../../src/services/execution-runtimes/JobBackfillService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function writeResults(root: string) {
	const reverify = join(root, 'results-reverify', 'luna');
	const build = join(root, 'results-build');
	mkdirSync(reverify, { recursive: true });
	mkdirSync(build, { recursive: true });
	writeFileSync(
		join(reverify, 'result.json'),
		JSON.stringify({
			task: 'task-42', unit: 'service.example', status: 'pass',
			tried: [
				{ model: 'haiku', seconds: 1.25, ok: false },
				{ model: 'luna', seconds: 2.5, ok: true }
			]
		})
	);
	writeFileSync(join(build, 'result.json'), JSON.stringify({ task: 'task-43', status: 'pass' }));
}

async function importExamples(directory: string) {
	const root = join(directory, 'results');
	const history = new JobHistoryRepository(join(directory, 'history'));
	writeResults(root);
	try {
		const service = new JobBackfillService(history);
		const first = service.import(root);
		const records = history.all().map(({ id, type, model, attempt, durationMs, outcome }) => ({
			id, type, model, attempt, durationMs, outcome
		}));
		const repeated = service.import(root);
		return { first, records, repeated };
	} finally {
		history.close();
	}
}

test('Imports timed results once and skips missing timing', async () => {
	const result = await withTempDir('job-backfill-', importExamples);
	expect(result.first).toMatchObject({ imported: 2, duplicate: 0, skipped: 1, errors: [] });
	expect(result.records.map(({ model, durationMs }) => ({ model, durationMs }))).toEqual([
		{ model: 'haiku', durationMs: 1250 },
		{ model: 'luna', durationMs: 2500 }
	]);
	expect(result.repeated).toMatchObject({ imported: 0, duplicate: 2, skipped: 1, errors: [] });
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-job-backfill',
			symbol: 'import',
			state: 'imports-timed-results-once-and-skips-missing-timing',
			evidence: 'examples-cases',
			file: 'imports-timed-results-once-and-skips-missing-timing.json'
		},
		[
			{
				name: 'imports serial reverify attempts with their models, skips missing timing and deduplicates repeats',
				input: { timedAttempts: [1.25, 2.5], missingTiming: true },
				output: result
			}
		]
	);
});
