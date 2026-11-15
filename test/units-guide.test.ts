import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { enrollGuidanceVideo } from './support/enrollGuidanceVideo';
import { runHarness } from './support/cli';
import { measureWorkload } from './support/measureWorkload';
import {
	attachGuidanceShots,
	commitGuidance,
	entity,
	guidanceJson,
	guidanceProject,
	widgetManifest,
	writeGuidanceFile
} from './support/unitsGuidanceProject';

const roots: string[] = [];
afterEach(async () => {
	for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function project(states?: string[]) {
	const root = await guidanceProject(states);
	roots.push(root);
	return root;
}

async function addWorkspaceScenario(root: string) {
	const scenario = JSON.parse(
		await readFile(join(root, 'specification/scenarios/widget-catalog.json'), 'utf8')
	);
	scenario.id = 'workspace-coverage';
	scenario.units = [entity, 'component.other'];
	scenario.states = [
		{
			id: 'workspace-current',
			title: 'Workspace context',
			coverage: 'required',
			units: scenario.units
		}
	];
	scenario.evidence[0].states = ['workspace-current'];
	await writeGuidanceFile(
		root,
		'specification/scenarios/workspace-coverage.json',
		JSON.stringify(scenario)
	);
}

test('guide distinguishes named states and heuristic prop boundaries', async () => {
	const root = await project();
	const unit = widgetManifest();
	unit.contract.inputs = [
		{ name: 'Widget.label', type: 'string', required: false, default: '' },
		{ name: 'Widget.items', type: 'string[]', required: true },
		{ name: 'Widget.disabled', type: 'boolean', required: false, default: false }
	];
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	await writeGuidanceFile(
		root,
		'src/components/Widget.svelte',
		`<script lang="ts">let { status }: { status: 'loading' | 'unavailable' } = $props();</script>{#if status === 'unavailable'}Unavailable{/if}`
	);
	await addWorkspaceScenario(root);
	await commitGuidance(root);
	await measureWorkload(
		'workflow.development-tooling-guide-units',
		'derive-state-checklist',
		async () => {
			const { report, exitCode } = await guidanceJson(root, ['guide', entity]);
			expect(exitCode).toBe(1);
			expect(report.states.map((state: { name: string }) => state.name)).toEqual([
				'default',
				'loading',
				'failed'
			]);
			expect(report.guesses).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: 'unavailable', origin: 'GUESS' }),
					...[
						'without-label',
						'with-label',
						'empty-label',
						'items-none',
						'items-one',
						'items-many',
						'disabled'
					].map((name) => expect.objectContaining({ name, origin: 'GUESS' }))
				])
			);
			expect(report.next).toMatchObject({
				state: 'default',
				commands: [
					expect.stringContaining('tests/catalog.spec.ts'),
					`harness verify run --priority agent-test --entity ${entity}`,
					`harness units guide ${entity}`
				]
			});
		}
	);
});

test('guide counts verified shots per state and viewport and reaches DONE', async () => {
	const root = await project(['default', 'loading']);
	const unit = widgetManifest();
	unit.contract.inputs = [
		{ name: 'Widget.label', type: 'string', required: false, default: '' },
		{ name: 'Widget.mode', type: "'idle' | 'busy'", required: true }
	];
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	await commitGuidance(root);
	await attachGuidanceShots(root, ['default']);
	let result = await guidanceJson(root, ['guide', entity]);
	expect(result.report.states[0].status).toBe('DONE');
	expect(result.report.states[0].tests).toContainEqual({
		file: 'tests/catalog.spec.ts',
		viewports: ['desktop', 'tablet', 'mobile']
	});
	expect(
		result.report.states.find((state: { name: string }) => state.name === 'default')
	).toMatchObject({
		status: 'DONE',
		viewports: { desktop: 'DONE', tablet: 'DONE', mobile: 'DONE' }
	});
	expect(result.report.next.state).toBe('loading');
	await attachGuidanceShots(root, ['default', 'loading']);
	result = await guidanceJson(root, ['guide', entity]);
	expect(result).toMatchObject({
		exitCode: 0,
		report: { next: null, summary: { done: 2, missing: 0 } }
	});
	expect(result.report.guesses).toEqual(
		expect.arrayContaining(
			['without-label', 'with-label', 'idle', 'busy'].map((name) =>
				expect.objectContaining({ name, origin: 'GUESS' })
			)
		)
	);
	const text = await runHarness(['units', 'guide', entity], root);
	expect(text.stdout).toContain('ALL DONE');
	expect(text.stdout).toContain('DONE');
	await enrollGuidanceVideo(root);
	await commitGuidance(root);
	await attachGuidanceShots(root, ['default', 'loading']);
	const missingVideo = await guidanceJson(root, ['guide', entity]);
	expect(missingVideo.report.states[0].status).toBe('MISSING');
	expect(missingVideo.report.proof.gap).toMatch(/video/i);

	await writeGuidanceFile(
		root,
		'tests/duplicate/catalog.spec.ts',
		"test('default', () => expect(true).toBe(true));"
	);
	await commitGuidance(root);
	await attachGuidanceShots(root, ['default', 'loading']);
	const ambiguous = await guidanceJson(root, ['guide', entity]);
	expect(ambiguous.report.states[0]).toMatchObject({ tests: [], status: 'MISSING' });
});

test('guide rejects partial, stale and uncommitted coverage', async () => {
	const root = await project(['default']);
	await attachGuidanceShots(root, ['default'], ['desktop', 'tablet']);
	let result = await guidanceJson(root, ['guide', entity]);
	expect(result.report.states[0]).toMatchObject({
		status: 'MISSING',
		viewports: { desktop: 'DONE', tablet: 'DONE', mobile: 'MISSING' }
	});
	await writeGuidanceFile(
		root,
		'src/components/Widget.svelte',
		'<script>let {} = $props();</script>changed'
	);
	await commitGuidance(root);
	result = await guidanceJson(root, ['guide', entity]);
	expect(result.report.states[0].viewports.desktop).toBe('MISSING');
	await writeGuidanceFile(
		root,
		'packages/example/tests/e2e/support/otherVariants.ts',
		`export const states = { '${entity}': ['uncommitted'] };`
	);
	expect(
		(await guidanceJson(root, ['guide', entity])).report.states.map(
			(state: { name: string }) => state.name
		)
	).not.toContain('uncommitted');
});

test('a registry string alone is not a committed test, even with retained shots', async () => {
	const root = await project(['default', 'loading']);
	for (const text of [
		'// loading is mentioned but no test is authored',
		"test.skip('loading', () => expect(true).toBe(true));"
	]) {
		await writeGuidanceFile(root, 'tests/catalog.spec.ts', text);
		await commitGuidance(root);
		await attachGuidanceShots(root, ['default', 'loading']);
		const { report, exitCode } = await guidanceJson(root, ['guide', entity]);
		expect(exitCode).toBe(1);
		expect(
			report.states.every(
				(state: { tests: unknown[]; status: string }) =>
					state.tests.length === 0 && state.status === 'MISSING'
			)
		).toBe(true);
	}
});

test('guide rejects unknown identities with a useful diagnostic', async () => {
	const root = await project();
	const result = await runHarness(['units', 'guide', 'component.missing'], root, false);
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain('Unknown unit');
});
