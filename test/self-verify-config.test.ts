import type { Manifest } from './self-verify-config.test.types';
import { measureWorkload } from './support/measureWorkload';
import checksBaseline from './support/fixtures/verify-checks-baseline.json';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { verifyConfigSchema } from '../src/core/verifyTypes';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { verificationTarget } from './verification-targets';
import { ScenarioRepository } from '../src/repositories/verification-evidence/ScenarioRepository';
import { WorkingTreeAdapter } from '../src/adapters/git-source-history/WorkingTreeAdapter';
import {
	neededBuilds,
	scopedSetup
} from '../src/workflows/verification-evidence/run-verify/verification-service/buildScope';

/** Every file under a directory of this repository, as repository paths. */
function under(directory: string): string[] {
	return readdirSync(directory, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name));
}

/** True when a declared path, a file or a directory with a trailing slash, covers `path`. */
function covers(declared: string, path: string): boolean {
	const directory = declared.endsWith('/') ? declared : `${declared}/`;
	return path === declared || path.startsWith(directory);
}

test('this repository keeps source read-only and required scenario evidence complete', async () => {
	const config = verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8')));
	const manifests = under('specification/units').map(
		(file) => JSON.parse(readFileSync(file, 'utf8')) as Manifest
	);
	const source = manifests.flatMap((unit) => unit.owns.source);
	expect(source.length).toBeGreaterThan(500);
	// Loop state, scenarios, measurements and the registry itself are source too.
	const kept = [...source, ...under('specification'), ...under('test'), 'harness.verify.json'];
	expect(kept).toContain('specification/loops/agentic-self-hosting/loop.json');
	for (const declared of [...config.outputs, ...config.link]) {
		const covered = kept.filter((path) => covers(declared, path));
		expect([declared, covered]).toEqual([declared, []]);
	}
	// A build that is identified is compiled output, and it is declared as an output.
	for (const build of config.builds) {
		expect(config.outputs.some((declared) => covers(declared, `${build.directory}/x`))).toBe(true);
	}
	const scenarios = await new ScenarioRepository(process.cwd()).read(
		new WorkingTreeAdapter(process.cwd())
	);
	expect(
		scenarios.errors,
		'Every required repository scenario state has required evidence'
	).toEqual([]);
});

test('named check profiles preserve all existing check IDs, commands and effective timeouts', async () => {
	const config = await measureWorkload(
		'function.verify-types',
		'named-check-profile-expansion',
		() => verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8')))
	);
	const actual = config.checks.map((check) => ({
		id: check.path,
		command: check.command,
		timeoutMs: check.timeoutMs ?? config.timeouts.test
	}));
	expect(actual).toHaveLength(41);
	expect(actual).toEqual(checksBaseline);
});

test('every declared build has a tagged setup step; the catalog scope keeps install, kit sync and build:shell', () => {
	const config = verifyConfigSchema.parse(JSON.parse(readFileSync('harness.verify.json', 'utf8')));
	const produced = config.setup.flatMap((step) => step.builds ?? []);
	const declared = config.builds.map((build) => build.id);
	expect(
		declared.filter((id) => !produced.includes(id)),
		'Every declared build is produced by a tagged setup step'
	).toEqual([]);
	const catalog = scenarioManifestSchema.parse(
		JSON.parse(readFileSync('specification/scenarios/component-catalog-previews.json', 'utf8'))
	);
	const needed = neededBuilds([catalog]);
	expect(needed).toEqual(new Set(['shell-fixture']));
	// Root Vitest resolves package tsconfigs that extend generated SvelteKit configs, so the sync
	// step names no build and runs in every scope, including scenarios that need no build.
	const install = 'bun install --frozen-lockfile --backend=copyfile';
	const sync =
		'bun run --cwd packages/reports svelte-kit sync && bun run --cwd packages/desktop svelte-kit sync && bun run --cwd packages/hub svelte-kit sync';
	expect(scopedSetup(config.setup, needed).map((step) => step.command)).toEqual([
		install,
		sync,
		'bun run --cwd packages/reports build:shell'
	]);
	expect(scopedSetup(config.setup, new Set()).map((step) => step.command)).toEqual([install, sync]);
});

test('standalone evidence fixtures load outside the test runner', () => {
	const result = spawnSync(
		'bun',
		['-e', "import('./test/support/verifyRepo.ts').then(() => console.log('fixture ready'))"],
		{ encoding: 'utf8' }
	);
	expect(result.status, `standalone evidence fixtures load: ${result.stderr}`).toBe(0);
	expect(result.stdout.trim()).toBe('fixture ready');
});

const wrappers = under('specification/scenarios').flatMap((path) => {
	const scenario = scenarioManifestSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
	return scenario.kind === 'headless' || scenario.id === 'vault-local-setup'
		? scenario.tests
				.filter((check) => check.target.includes('test/verification-output.ts'))
				.map((check) => ({
					scenario: scenario.id,
					states: scenario.states.map((state) => state.id),
					...check
				}))
		: [];
});
test.each(wrappers)('headless $scenario wrapper $id admits its registered test', (check) => {
	const command = check.target.split(/\s+/);
	const wrapper = command.findIndex((part) => part.endsWith('test/verification-output.ts'));
	const args = command.slice(wrapper + 1);
	expect(args, 'verification-output accepts exactly one runner and one file').toHaveLength(2);
	const roots = [
		process.cwd(),
		...readdirSync('packages').map((name) => join(process.cwd(), 'packages', name))
	];
	const registered = roots.flatMap((cwd) => {
		try {
			return [verificationTarget(check.scenario, args[0], args[1], cwd)];
		} catch {
			return [];
		}
	});
	expect(registered, 'declared wrappers must resolve to one registered package').toHaveLength(1);
	for (const state of registered[0].states) expect(check.states).toContain(state);
});
