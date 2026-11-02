import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { RegressionProofRepository } from '../../src/repositories/verification-evidence/RegressionProofRepository';
import { canonicalJson } from '../../src/utils/development-tooling/canonicalJson';
import { regressionHash } from '../../src/utils/git-source-history/regressionHistory';
import { runHarness } from './cli';

export const entity = 'component.widget';
export const viewports = ['desktop', 'tablet', 'mobile'];

export function widgetManifest(): ComponentManifest {
	return {
		schemaVersion: 1,
		id: entity,
		kind: 'component',
		title: 'Widget',
		responsibility: 'Displays a widget.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['src/components/Widget.svelte'], symbols: ['Widget'] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: 'Widget', type: 'markup' }],
			errors: [],
			errorStatus: 'declared'
		},
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/components/Widget.svelte',
			targets: [{ kind: 'module', entry: 'src/components/Widget.svelte' }]
		},
		scenarios: ['widget-catalog'],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

export async function writeGuidanceFile(root: string, path: string, text: string) {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), text);
}

export async function guidanceProject(states = ['default', 'loading', 'failed']) {
	const root = await mkdtemp(join(tmpdir(), 'units-guidance-'));
	const git = new GitAdapter(root);
	await git.run(['init', '--initial-branch=feat/sol-12-units-guide']);
	await git.run(['config', 'user.name', 'Harness Fixture']);
	await git.run(['config', 'user.email', 'fixture@harness.invalid']);
	await git.run(['commit', '--allow-empty', '-m', 'chore: fixture parent']);
	await writeGuidanceFile(
		root,
		'src/components/Widget.svelte',
		'<script lang="ts">let {}: {} = $props();</script>'
	);
	await writeGuidanceFile(
		root,
		'specification/units/component.widget.json',
		JSON.stringify(widgetManifest())
	);
	await writeGuidanceCatalog(root, states);
	await commitGuidance(root);
	return root;
}

async function writeGuidanceCatalog(root: string, states: string[]) {
	await writeGuidanceFile(
		root,
		'packages/example/tests/e2e/support/catalogVariants.ts',
		`export const variants = { '${entity}': ${JSON.stringify(states.filter((s) => s !== 'default'))} };`
	);
	await writeGuidanceFile(
		root,
		'tests/catalog.spec.ts',
		`import { variants } from '../packages/example/tests/e2e/support/catalogVariants';\nfor (const state of ['default', ...variants['${entity}']]) test(state, () => expect(state).toBeTruthy());`
	);
	await writeGuidanceFile(
		root,
		'specification/scenarios/widget-catalog.json',
		JSON.stringify({
			schemaVersion: 1,
			id: 'widget-catalog',
			title: 'Widget catalog',
			kind: 'ui',
			units: [entity],
			states: states.map((state) => ({
				id: `${entity.replaceAll('.', '-')}${state === 'default' ? '' : '-' + state}`,
				title: state,
				coverage: 'required',
				units: [entity]
			})),
			viewports: viewports.map((id) => ({ id, width: 1, height: 1 })),
			tests: [
				{
					id: 'catalog',
					kind: 'e2e',
					runner: 'command',
					target: 'bun x playwright test --config src/configs/playwrightConfig.ts catalog.spec.ts'
				}
			],
			evidence: [
				{
					id: 'shot',
					kind: 'screenshot',
					states: states.map(
						(state) => `${entity.replaceAll('.', '-')}${state === 'default' ? '' : '-' + state}`
					),
					viewports,
					required: true
				}
			]
		})
	);
}

export async function commitGuidance(root: string) {
	const git = new GitAdapter(root);
	await git.run(['add', '.']);
	await git.run(['commit', '-m', 'feat: fixture state matrix']);
	return git.run(['rev-parse', 'HEAD']);
}

export async function guidanceJson(root: string, args: string[]) {
	const result = await runHarness(['units', ...args, '--json'], root, false);
	expect(result.stdout, result.stderr).toContain('"entity');
	return { ...result, report: JSON.parse(result.stdout) };
}

/** Real sealed Git evidence, including original image bytes; never scratch-file discovery. */
export async function attachGuidanceShots(root: string, states: string[], devices = viewports) {
	const git = new GitAdapter(root);
	const commit = await git.run(['rev-parse', 'HEAD']);
	const bytes = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQUDAAAACkAGE0Zn1yAAAAAElFTkSuQmCC',
		'base64'
	);
	const captures = states.flatMap((state) =>
		devices.map((viewport) => ({
			unit: entity,
			capture: {
				evidence: 'shot',
				kind: 'screenshot' as const,
				state,
				viewport,
				status: 'passed' as const,
				path: `focused/${state}-${viewport}.png`,
				sha256: regressionHash(bytes),
				bytes: bytes.length,
				mediaType: 'image/png',
				capturedAt: '2026-11-01T23:00:00Z',
				provenance: 'actual-capture' as const,
				server: { buildId: 'widget-build', revision: commit }
			}
		}))
	);
	const record = await guidanceShotRecord(root, captures);
	await new RegressionProofRepository(root).save(
		record,
		Buffer.from('fixture proof'),
		captures.map(({ capture }) => ({ path: capture.path, bytes }))
	);
}

async function guidanceShotRecord(
	root: string,
	captures: NonNullable<RegressionRecord['captures']>
) {
	const git = new GitAdapter(root);
	const commit = await git.run(['rev-parse', 'HEAD']);
	const tree = await git.run(['rev-parse', 'HEAD^{tree}']);
	const parent = await git.run(['rev-parse', 'HEAD^']);
	const output = Buffer.from('fixture proof');
	const draft: Omit<RegressionRecord, 'id'> = {
		schemaVersion: 1,
		loop: 'widget-catalog',
		phase: 'capture',
		status: 'passed',
		source: { commit, tree, parent },
		units: [entity],
		tests: ['tests/catalog.spec.ts'],
		inputs: [
			{
				path: 'tests/catalog.spec.ts',
				hash: await git.run(['rev-parse', 'HEAD:tests/catalog.spec.ts'])
			}
		],
		command: 'fixture',
		assertion: 'fixture proof',
		profile: 'fixture',
		startedAt: '2026-11-01T23:00:00Z',
		finishedAt: '2026-11-01T23:00:01Z',
		exitCode: 0,
		log: { path: 'output.log', sha256: regressionHash(output), bytes: output.length },
		captures
	};
	return { ...draft, id: regressionHash(canonicalJson(draft)) };
}
