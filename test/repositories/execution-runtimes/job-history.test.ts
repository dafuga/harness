import { expect, test } from 'vitest';
import { JobHistoryRepository } from '../../../src/repositories/execution-runtimes/JobHistoryRepository';
import { withTempDir } from '../../support/temporary';

test('start, end and import retain durable idempotent job attempts', async () => {
	await withTempDir('harness-jobs-', (home) => {
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
	});
});
