import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { VerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import {
	neededBuilds,
	scopedSetup
} from '../../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/** Reads a repository JSON file relative to this test. */
function json<T>(path: string): T {
	return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
}

const scenario = scenarioManifestSchema.parse(
	json('../../specification/scenarios/kernel-build.json')
);
const verify = json<VerifyConfig>('../../harness.verify.json');
const packageScripts = json<{ scripts: Record<string, string> }>('../../package.json').scripts;

/** The proposed manifest edit: the kernel-build scenario names only the existing reports build. */
const proposed = scenarioManifestSchema.parse({ ...scenario, builds: ['reports'] });

const stockReportsStep = 'bun run build';

test('the kernel-build scenario declares the reports build that supplies the kernel artifacts', () => {
	expect(neededBuilds([scenario])).toEqual(new Set(['reports']));
});

test('only the existing reports setup step reaches build:kernel, so the kernel is built once', () => {
	const reaching = verify.setup.filter(
		(step) => step.command.includes('build:kernel') || step.command === stockReportsStep
	);
	expect(reaching.map((step) => step.command)).toEqual([stockReportsStep]);
	expect(reaching[0]?.builds).toEqual(['reports']);
	expect(packageScripts.build).toContain('bun run build:kernel');
});

test('the proposed reports scope skips shell-fixture, entity-preview and desktop setup', () => {
	const commands = scopedSetup(verify.setup, neededBuilds([proposed])).map((step) => step.command);
	expect(commands).toEqual([
		'bun install --frozen-lockfile --backend=copyfile',
		'bun run --cwd packages/reports svelte-kit sync && bun run --cwd packages/desktop svelte-kit sync && bun run --cwd packages/hub svelte-kit sync',
		stockReportsStep
	]);
});

test('the build:kernel script still compiles the kernel with scripts/build-kernel.ts', () => {
	expect(packageScripts['build:kernel']).toContain('bun scripts/build-kernel.ts');
});
