import { versionInitialized } from './support/checkRunVersion';
import { expect, test, vi } from 'vitest';
import type { IsolatedResult } from '../src/utils/run-isolated/runIsolated';
import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService';
import { componentManifestSchema, type ComponentManifest } from '../src/core/unitTypes';
import checkRunManifest from '../specification/units/service.check-run.json';
import {
	browserDiagnostics,
	inheritedBudget,
	invalidPriority,
	refusedDiagnostics
} from './support/checkRunCases';

// The run case starts real children and waits for a real timeout, so it needs more than the default.
vi.setConfig({ testTimeout: 60_000 });

componentManifestSchema.parse(checkRunManifest);
new TestExpectationService().registerCases(
	test,
	checkRunManifest as unknown as ComponentManifest,
	'test/browser-error-evidence.test.ts',
	{
		'run.initialized': runInitialized,
		'version.initialized': versionInitialized
	}
);

/** Original assertions run first; the inherited budget runs last so it cannot hide them. */
async function runInitialized(): Promise<void> {
	await browserDiagnostics(0);
	await browserDiagnostics(1);
	await refusedDiagnostics('malformed');
	await refusedDiagnostics('timeout');
	await settlementFailures();
	await invalidPriority();
	await inheritedBudget();
}

/** Fake settlement replaces only the isolated runner; module state is restored afterwards. */
async function settlementFailures(): Promise<void> {
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
	vi.resetModules();
	vi.doMock('../src/utils/run-isolated/runIsolated', () => ({ runIsolated: async () => left }));
	try {
		const { CheckRunService } = await import('../src/services/CheckRunService');
		vi.doUnmock('../src/utils/run-isolated/runIsolated');
		const context = { commit: 'made-up', tree: 'made-up', profile: 'made-up', env: {} };
		const service = new CheckRunService({
			...context,
			snapshot: '/made/up',
			directory: '/made/up'
		});
		const check = { id: 'page', name: 'page', target: 'page', cwd: '.', command: 'true' };
		const outcome = await service.run({
			...check,
			kind: 'unit',
			runner: 'command',
			timeoutMs: 1000
		});
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
	} finally {
		vi.doUnmock('../src/utils/run-isolated/runIsolated');
		vi.resetModules();
	}
}
