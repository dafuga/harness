import type { Scenario } from './workflow.verification-evidence-run-verify-verification-service-build-scope.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

const UNIT_ID = 'workflow.verification-evidence-run-verify-verification-service-build-scope';

const BASE = {
	schemaVersion: 1,
	id: 'reports-preview',
	title: 'Reports preview',
	kind: 'ui',
	units: ['reports.page.explorer'],
	states: [{ id: 'default', title: 'Default', coverage: 'required' }],
	viewports: [{ id: 'desktop', width: 1280, height: 800 }],
	tests: [
		{
			id: 'reports-preview-test',
			kind: 'e2e',
			runner: 'playwright',
			target: 'test/reports-preview.spec.ts'
		}
	],
	builds: ['reports'],
	evidence: []
};

const SETUP = [
	{ command: 'bun install --frozen-lockfile --backend=copyfile' },
	{ command: 'bun run build', builds: ['reports'] },
	{ command: 'bun run build:desktop', builds: ['desktop-renderer'] }
];

function scenario(extra: Record<string, unknown>): Scenario {
	return { ...BASE, ...extra } as unknown as Scenario;
}

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function sortedBuilds(builds: Set<string> | 'all'): string[] | 'all' {
	return builds === 'all' ? 'all' : [...builds].sort();
}

test('Collects the declared builds of each scenario', () => {
	const scenarios = [
		scenario({ builds: ['reports'] }),
		scenario({ builds: ['desktop-renderer', 'reports'] })
	];
	const declared = sortedBuilds(neededBuilds(scenarios));
	const explicitEmpty = sortedBuilds(neededBuilds([scenario({ builds: [] })]));

	expect(declared).toEqual(['desktop-renderer', 'reports']);
	expect(explicitEmpty).toEqual([]);
	recordExampleCases(meta('neededBuilds', 'collects-the-declared-builds-of-each-scenario'), [
		{ name: 'declared builds of two scenarios are collected', input: { scenarios }, output: declared },
		{
			name: 'an explicit empty builds list needs no build',
			input: { scenarios: [scenario({ builds: [] })] },
			output: explicitEmpty
		}
	]);
});

test('Requires all builds when evidence names no build', () => {
	const withoutEvidence = [scenario({ builds: undefined, evidence: [] })];
	const withBuildlessEvidence = [scenario({ builds: undefined, evidence: [{}] })];
	const withBuildEvidence = [scenario({ builds: undefined, evidence: [{ build: 'reports' }] })];
	const all = neededBuilds(withoutEvidence);
	const buildless = neededBuilds(withBuildlessEvidence);
	const fromEvidence = sortedBuilds(neededBuilds(withBuildEvidence));

	expect(all).toBe('all');
	expect(buildless).toBe('all');
	expect(fromEvidence).toEqual(['reports']);
	recordExampleCases(meta('neededBuilds', 'requires-all-builds-when-evidence-names-no-build'), [
		{ name: 'a scenario without declared builds or evidence needs all builds', input: { scenarios: withoutEvidence }, output: 'all' },
		{ name: 'an evidence item without a build needs all builds', input: { scenarios: withBuildlessEvidence }, output: 'all' },
		{ name: 'evidence build ids supply the needed builds', input: { scenarios: withBuildEvidence }, output: fromEvidence }
	]);
});

test('Keeps setup steps that name a needed build or no build', () => {
	const reports = scopedSetup(SETUP, new Set(['reports']));
	const none = scopedSetup(SETUP, new Set<string>());

	expect(reports.map((step) => step.command)).toEqual([
		'bun install --frozen-lockfile --backend=copyfile',
		'bun run build'
	]);
	expect(none.map((step) => step.command)).toEqual([
		'bun install --frozen-lockfile --backend=copyfile'
	]);
	recordExampleCases(meta('scopedSetup', 'keeps-setup-steps-that-name-a-needed-build-or-no-build'), [
		{ name: 'the reports build keeps the unscoped and reports steps', input: { setup: SETUP, needed: ['reports'] }, output: reports },
		{ name: 'no needed build keeps only the unscoped step', input: { setup: SETUP, needed: [] }, output: none }
	]);
});

test('Keeps every setup step when the needed builds are all', () => {
	const all = scopedSetup(SETUP, 'all');

	expect(all).toEqual(SETUP);
	expect(all).not.toBe(SETUP);
	recordExampleCases(meta('scopedSetup', 'keeps-every-setup-step-when-the-needed-builds-are-all'), [
		{ name: 'all builds needed keeps every setup step in order', input: { setup: SETUP, needed: 'all' }, output: all }
	]);
});
