import { expect, test } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { JobHistoryRepository } from '../../../src/repositories/execution-runtimes/JobHistoryRepository';
import { withTempDir } from '../../support/temporary';

test('start, end and import retain durable idempotent job attempts', async () => {
	await withTempDir('harness-jobs-', async (home) => {
		const key = { id: 'a', source: 'run', attempt: 1 };
		const start = { ...key, unit: 'unit.a', type: 'smell', model: 'luna', startedAt: 1000 };
		const repo = new JobHistoryRepository(home);
		repo.start(start);
		repo.start(start);
		expect(repo.all()).toHaveLength(1);
		expect(repo.end({ ...key, endedAt: 4000, outcome: 'pass' }).durationMs).toBe(3000);
		repo.end({ ...key, endedAt: 5000, outcome: 'fail' });
		expect(repo.all()[0].outcome).toBe('pass');
		expect(() => repo.end({ ...key, id: 'missing', endedAt: 5000, outcome: 'pass' })).toThrow();
		expect(() => repo.start({ ...start, id: 'invalid', startedAt: NaN })).toThrow();
		expect(() => repo.start({ ...start, id: 'invalid', attempt: 0 })).toThrow();
		repo.start({ ...start, attempt: 2 });
		expect(() => repo.end({ ...key, attempt: 2, endedAt: 0, outcome: 'pass' })).toThrow();
		repo.close();
		const reopened = new JobHistoryRepository(home);
		expect(reopened.all()).toHaveLength(2);
		expect(
			reopened.import({ ...start, id: 'import', endedAt: 2000, durationMs: 1000, outcome: 'fail' })
		).toBe(true);
		expect(
			reopened.import({ ...start, id: 'import', endedAt: 2000, durationMs: 1000, outcome: 'fail' })
		).toBe(false);
		reopened.close();
		await concurrentWriters(home);
	});
});

async function concurrentWriters(home: string): Promise<void> {
	const source = resolve(
		import.meta.dirname,
		'../../../src/repositories/execution-runtimes/JobHistoryRepository.ts'
	);
	const run = promisify(execFile);
	await Promise.all(
		Array.from({ length: 20 }, (_, i) =>
			run('bun', [
				'-e',
				`
  import { JobHistoryRepository } from ${JSON.stringify(source)};
  const r = new JobHistoryRepository(${JSON.stringify(home)});
  const key = { id: 'writer-${i}', source: 'parallel', attempt: 1 };
  r.start({ ...key, unit: 'fixture', type: 'smell', model: 'luna', startedAt: 1000 });
  r.end({ ...key, endedAt: 2000, outcome: 'pass' }); r.close();
 `
			])
		)
	);
	const check = new JobHistoryRepository(home);
	try {
		expect(check.all().filter((r) => r.source === 'parallel' && r.outcome === 'pass')).toHaveLength(
			20
		);
	} finally {
		check.close();
	}
}
