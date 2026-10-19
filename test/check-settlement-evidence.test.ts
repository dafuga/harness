import { expect, test, vi } from 'vitest';
import type { IsolatedResult } from '../src/utils/run-isolated/runIsolated';

test('a failed check says which processes it stopped, which outlasted a signal, which it left', async () => {
	const identities = [1, 2, 3].map((pid) => ({ pid, started: 'Mon Oct 12 10:00:00 2026' }));
	const left: IsolatedResult = {
		status: 'failed',
		exitCode: 0,
		timedOut: false,
		durationMs: 1,
		log: { path: '/made/up/page.log', bytes: 0, sha256: '' },
		survivors: identities,
		stopped: 1,
		resisted: 1,
		unknown: false
	};
	vi.doMock('../src/utils/runIsolated', () => ({ runIsolated: async () => left }));
	const { CheckRunService } = await import('../src/services/CheckRunService');
	vi.doUnmock('../src/utils/runIsolated');
	const context = { commit: 'made-up', tree: 'made-up', profile: 'made-up', env: {} };
	const service = new CheckRunService({ ...context, snapshot: '/made/up', directory: '/made/up' });
	const check = { id: 'page', name: 'page', target: 'page', cwd: '.', command: 'true' };
	const outcome = await service.run({ ...check, kind: 'unit', runner: 'command', timeoutMs: 1000 });
	expect(outcome.passed).toBe(false);
	expect(outcome.failures).toHaveLength(3);
	expect(outcome.failures[0]).toBe(
		'test page left 1 process running after it ended; it was stopped'
	);
	expect(outcome.failures[1]).toContain('left 1 process running after it ended');
	expect(outcome.failures[1]).toContain('it was signalled and did not end');
	expect(outcome.failures[1]).not.toContain('not signalled');
	expect(outcome.failures[2]).toContain('left 1 process running');
	expect(outcome.failures[2]).toContain('it was not signalled and may still run');
});
