import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { verifyConfigSchema } from '../../src/core/verification-evidence/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/**
 * Headless scenarios whose registered tests import only `src/` sources and spawn `src/index.ts`;
 * none loads a compiled build output (`reports`, `planning`, `desktop-renderer`, `desktop-main`...).
 */
const headless = [
	'planning-artifacts',
	'desktop-recorded-evidence',
	'module-tasks',
	'plan-fixture-contracts'
] as const;

const readJson = (path: string): unknown =>
	JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const scenarios = headless.map((id) =>
	scenarioManifestSchema.parse(readJson(`../../specification/scenarios/${id}.json`))
);
const config = verifyConfigSchema.parse(readJson('../../harness.verify.json'));

test.each(headless)('%s declares an explicit empty build list', (id) => {
	const manifest = scenarioManifestSchema.parse(
		readJson(`../../specification/scenarios/${id}.json`)
	);
	expect(manifest.builds).toEqual([]);
});

test('the four headless scenarios need no compiled build, so only unscoped setup runs', () => {
	const needed = neededBuilds(scenarios);
	expect(needed).toEqual(new Set());
	expect(scopedSetup(config.setup, needed).map((step) => step.command)).toEqual([
		'bun install --frozen-lockfile --backend=copyfile',
		'bun run --cwd packages/reports svelte-kit sync && bun run --cwd packages/desktop svelte-kit sync && bun run --cwd packages/hub svelte-kit sync'
	]);
});
