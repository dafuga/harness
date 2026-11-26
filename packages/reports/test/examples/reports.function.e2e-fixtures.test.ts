import type { RuntimeEnvironment } from '../../../../src/core/execution-runtimes/runtimeTypes.types';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	e2eFixtures,
	freePorts,
	openE2eRun,
	namedE2eRun,
	closeE2eRun
} from '../../src/utils/development-tooling/e2e-fixtures/e2eFixtures';
import {
	E2eRootNotSetError,
	type E2eFixtures
} from '../../src/utils/development-tooling/e2e-fixtures/e2eFixtures.types';

const state = 'resolves-isolated-fixtures-and-manages-run-lifecycle';

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), 'harness-fixture-example-'));
}

function summary(fixtures: E2eFixtures): object {
	return {
		root: fixtures.root,
		reports: fixtures.reports,
		console: fixtures.console,
		analytics: fixtures.analytics,
		build: fixtures.build,
		site: fixtures.site('demo')
	};
}

test('Resolves isolated fixtures and manages run lifecycle', () => {
	const root = tempRoot();
	const namedRoot = tempRoot();
	const env: RuntimeEnvironment = { HARNESS_E2E_ROOT: root };
	const overridden: RuntimeEnvironment = {
		HARNESS_E2E_ROOT: namedRoot,
		HARNESS_CONSOLE_E2E_HOME: join(namedRoot, 'console-home'),
		HARNESS_ANALYTICS_HOME: join(namedRoot, 'analytics-home')
	};
	try {
		const fixtures = e2eFixtures(env);
		const overriddenFixtures = e2eFixtures(overridden);
		const openedEnv: RuntimeEnvironment = {
			HARNESS_E2E_ROOT: root,
			PROJECT_REPORTS_E2E_PORT: '4173'
		};
		const opened = openE2eRun(openedEnv);
		const ownedEnv: RuntimeEnvironment = {
			HARNESS_E2E_ROOT: root,
			HARNESS_E2E_OWNER: String(process.pid)
		};
		const isNamed = namedE2eRun({ HARNESS_E2E_ROOT: root });
		const isOwnedNamed = namedE2eRun(ownedEnv);
		const ports = freePorts(0);
		closeE2eRun({ HARNESS_E2E_ROOT: root, HARNESS_E2E_OWNER: 'other-process' });
		expect([
			fixtures.root,
			fixtures.reports,
			overriddenFixtures.console,
			overriddenFixtures.analytics,
			ports,
			isNamed,
			isOwnedNamed
		]).toEqual([
			root,
			join(root, 'reports'),
			overridden.HARNESS_CONSOLE_E2E_HOME,
			overridden.HARNESS_ANALYTICS_HOME,
			[],
			true,
			false
		]);
		expect(openedEnv.PROJECT_REPORTS_E2E_PORT).toBe('4173');
		expect(opened.root).toBe(root);
		recordExampleCases(
			{
				unitId: 'reports.function.e2e-fixtures',
				symbol: 'e2eFixtures',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{ name: 'resolves default fixture locations', input: env, output: summary(fixtures) },
				{
					name: 'honors console and analytics overrides',
					input: overridden,
					output: summary(overriddenFixtures)
				},
				{
					name: 'preserves named port and classifies run ownership',
					input: openedEnv,
					output: {
						fixtures: summary(opened),
						port: openedEnv.PROJECT_REPORTS_E2E_PORT,
						isNamed,
						isOwnedNamed
					}
				},
				{ name: 'zero requested ports', input: { count: 0 }, output: ports }
			]
		);
	} finally {
		closeE2eRun({});
		rmSync(root, { recursive: true, force: true });
		rmSync(namedRoot, { recursive: true, force: true });
	}
});

test('Rejects fixture lookup without a run root', () => {
	let message = '';
	try {
		e2eFixtures({});
	} catch (error) {
		message = error instanceof E2eRootNotSetError ? error.name : 'unexpected error';
	}
	expect(message).toBe('E2eRootNotSetError');
	recordExampleCases(
		{
			unitId: 'reports.function.e2e-fixtures',
			symbol: 'e2eFixtures',
			state: 'rejects-fixture-lookup-without-a-run-root',
			evidence: 'examples-cases',
			file: 'rejects-fixture-lookup-without-a-run-root.json'
		},
		[{ name: 'missing run root', input: {}, error: { name: message } }]
	);
});
