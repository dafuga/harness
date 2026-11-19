import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { verifyConfigSchema } from '../../src/core/verification-evidence/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/**
 * Headless scenarios whose exact registered tests read source modules and fixtures only. None of
 * them consumes a compiled application output, so each declares no build prerequisite.
 */
const headless = [
	'hosted-client-copies',
	'hosted-design-options',
	'git-evidence-read',
	'history-fixture-integrity',
	'design-option-storage',
	'modular-h-native-contract',
	'modular-h-branding-contract'
] as const;

/** The unscoped setup a scoped headless run keeps: the lockfile install and dependency sync. */
const unscopedCommands = [
	'bun install --frozen-lockfile --backend=copyfile',
	'bun run --cwd packages/reports svelte-kit sync && bun run --cwd packages/desktop svelte-kit sync && bun run --cwd packages/hub svelte-kit sync'
];

const config = verifyConfigSchema.parse(
	JSON.parse(readFileSync(new URL('../../harness.verify.json', import.meta.url), 'utf8'))
);

function scenario(id: string) {
	const file = new URL(`../../specification/scenarios/${id}.json`, import.meta.url);
	return scenarioManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

const commandsFor = (needed: ReadonlySet<string> | 'all') =>
	scopedSetup(config.setup, needed).map((step) => step.command);

test('the real setup has compiled build steps that a scoped headless run skips', () => {
	const buildSteps = config.setup.filter((step) => (step.builds ?? []).length > 0);
	expect(buildSteps.length).toBeGreaterThan(0);
	expect(commandsFor('all')).toHaveLength(config.setup.length);
	expect(config.setup.filter((step) => !step.builds).map((step) => step.command)).toEqual(
		unscopedCommands
	);
});

test.each(headless)(
	'%s declares no compiled build prerequisite and keeps only unscoped setup',
	(id) => {
		const manifest = scenario(id);
		expect(manifest.builds).toEqual([]);
		const needed = neededBuilds([manifest]);
		expect(needed).toEqual(new Set());
		expect(commandsFor(needed)).toEqual(unscopedCommands);
	}
);

test('the seven headless scenarios together need no compiled build', () => {
	const manifests = headless.map(scenario);
	const needed = neededBuilds(manifests);
	expect(needed).toEqual(new Set());
	expect(commandsFor(needed)).toEqual(unscopedCommands);
});
