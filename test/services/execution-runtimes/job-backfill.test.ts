import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JobBackfillService } from '../../../src/services/execution-runtimes/JobBackfillService';
import { JobHistoryRepository } from '../../../src/repositories/execution-runtimes/JobHistoryRepository';
import { withTempDir } from '../../support/temporary';

test('import reads historical phase results once and skips invalid or absent timing', async () => {
	await withTempDir('harness-backfill-', (root) => {
		const dir = join(root, 'results-p2b-smells-a', 'luna', 'task');
		mkdirSync(dir, { recursive: true });
		const path = join(dir, 'result.json');
		writeFileSync(
			path,
			JSON.stringify({
				task: 'task',
				model: 'luna',
				status: 'pass',
				seconds: 120,
				tasks: [{ seconds: 90, kind: 'code' }]
			})
		);
		const repo = new JobHistoryRepository(join(root, 'history'));
		const service = new JobBackfillService(repo);
		expect(service.import(root)).toMatchObject({ imported: 1, skipped: 0 });
		expect(service.import(root)).toMatchObject({ imported: 0, duplicate: 1 });
		expect(repo.all()[0]).toMatchObject({
			type: 'smell',
			durationMs: 120000,
			timingSource: 'file-mtime-minus-duration'
		});
		writeFileSync(
			path,
			JSON.stringify({ task: 'task', model: 'luna', status: 'pass', seconds: -1 })
		);
		expect(service.import(root)).toMatchObject({ skipped: 1 });
		repo.close();
	});
});
