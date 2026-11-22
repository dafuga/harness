import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
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
		verifyAttempts(root, repo, service);
		writeFileSync(
			path,
			JSON.stringify({ task: 'task', model: 'luna', status: 'pass', seconds: -1 })
		);
		expect(service.import(root)).toMatchObject({ skipped: 1 });
		verifyUnknownModel(root, repo, service);
		repo.close();
	});
});

function verifyAttempts(
	root: string,
	repo: JobHistoryRepository,
	service: JobBackfillService
): void {
	const dir = join(root, 'results-code-phase-reverify', 'gate');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, 'result.json');
	writeFileSync(
		path,
		JSON.stringify({
			task: 'gate',
			unit: 'unit.gate',
			model: 'haiku',
			status: 'pass',
			tried: [
				{ model: 'luna', seconds: 10, ok: false },
				{ model: 'haiku', seconds: 20, ok: true }
			]
		})
	);
	const endedAt = Math.round(statSync(path).mtimeMs);
	repo.import({
		id: 'gate',
		unit: 'unit.gate',
		source: `backfill:${path}`,
		attempt: 1,
		type: 'reverify',
		model: 'haiku',
		startedAt: endedAt - 30000,
		endedAt,
		durationMs: 30000,
		outcome: 'pass',
		timingSource: 'file-mtime-minus-duration'
	});
	expect(service.import(root)).toMatchObject({ imported: 2, duplicate: 1 });
	expect(repo.all().filter((row) => row.type === 'reverify')).toMatchObject([
		{ model: 'luna', durationMs: 10000, attempt: 1, outcome: 'fail' },
		{ model: 'haiku', durationMs: 20000, attempt: 2, outcome: 'pass' }
	]);
	expect(service.import(root)).toMatchObject({ imported: 0, duplicate: 3 });
	expect(repo.all()).toHaveLength(3);
}

function verifyUnknownModel(
	root: string,
	repo: JobHistoryRepository,
	service: JobBackfillService
): void {
	const dir = join(root, 'results-components', 'shape');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, 'result.json');
	writeFileSync(path, JSON.stringify({ unit: 'shape', seconds: 1, status: 'pass' }));
	const endedAt = Math.round(statSync(path).mtimeMs);
	repo.import({
		id: 'shape',
		unit: 'shape',
		source: `backfill:${path}`,
		attempt: 1,
		type: 'component',
		model: 'shape',
		startedAt: endedAt - 1000,
		endedAt,
		durationMs: 1000,
		outcome: 'pass',
		timingSource: 'file-mtime-minus-duration'
	});
	expect(service.import(root)).toMatchObject({ imported: 1, duplicate: 2, skipped: 1 });
	expect(repo.all().find((row) => row.id === 'shape')?.model).toBe('unknown');
	expect(service.import(root)).toMatchObject({ imported: 0, duplicate: 3, skipped: 1 });
}
