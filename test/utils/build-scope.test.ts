import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { VerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/** A scenario with the given evidence; an item that names no build may use any build. */
function scenario(id: string, evidence: { id: string; build?: string }[]) {
	return scenarioManifestSchema.parse({
		schemaVersion: 1,
		id,
		title: id,
		kind: 'ui',
		units: ['desktop.component.catalog-view'],
		states: [{ id: 'shown', title: 'Shown', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 920, height: 700 }],
		tests: [{ id: 'previews', kind: 'e2e', runner: 'command', target: 'previews.spec.ts' }],
		evidence: evidence.map((item) => ({
			kind: 'screenshot',
			states: ['shown'],
			viewports: ['desktop'],
			required: true,
			...item
		}))
	});
}

const setup: VerifyConfig['setup'] = [
	{ command: 'bun install --frozen-lockfile' },
	{ command: 'bun run build:shell', builds: ['shell-fixture'] },
	{ command: 'bun run build:reports', builds: ['reports'] },
	{ command: 'bun run build:both', builds: ['shell-fixture', 'reports'] },
	{ command: 'bun run generate-types', builds: [] },
	{ command: 'bun run codegen', timeoutMs: 60_000 }
];
/** The commands `scopedSetup` runs for the needed builds, in order. */
const commandsFor = (needed: ReadonlySet<string> | 'all') =>
	scopedSetup(setup, needed).map((step) => step.command);

test('catalog evidence needs just its build, and scenarios union their builds', () => {
	const file = new URL(
		'../../specification/scenarios/component-catalog-previews.json',
		import.meta.url
	);
	const catalog = scenarioManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
	expect(neededBuilds([catalog])).toEqual(new Set(['shell-fixture']));
	const pair = [
		scenario('one', [{ id: 'screens', build: 'shell-fixture' }]),
		scenario('two', [{ id: 'screens', build: 'reports' }])
	];
	expect(neededBuilds(pair)).toEqual(new Set(['shell-fixture', 'reports']));
});

test('evidence without a build, or no evidence at all, needs every build', () => {
	expect(neededBuilds([scenario('empty', [])])).toBe('all');
	const partial = scenario('partial', [{ id: 'x', build: 'one' }, { id: 'y' }]);
	expect(neededBuilds([partial])).toBe('all');
	const tagged = scenario('tagged', [{ id: 'x', build: 'one' }]);
	expect(neededBuilds([tagged, scenario('loose', [{ id: 'y' }])])).toBe('all');
});

test('a setup step that names no build always runs', () => {
	expect(commandsFor(new Set<string>())).toEqual([
		'bun install --frozen-lockfile',
		'bun run generate-types',
		'bun run codegen'
	]);
});

test('a setup step that names builds runs only when one of them is needed', () => {
	expect(commandsFor(new Set(['shell-fixture']))).toEqual([
		'bun install --frozen-lockfile',
		'bun run build:shell',
		'bun run build:both',
		'bun run generate-types',
		'bun run codegen'
	]);
	expect(commandsFor(new Set(['reports']))).toEqual([
		'bun install --frozen-lockfile',
		'bun run build:reports',
		'bun run build:both',
		'bun run generate-types',
		'bun run codegen'
	]);
});

test("'all' keeps every setup step, in order", () => {
	expect(commandsFor('all')).toEqual(setup.map((step) => step.command));
});
