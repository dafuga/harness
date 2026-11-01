import { rm } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
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
	await commitGuidance(root);
	await measureWorkload(
		'workflow.development-tooling-guide-units',
		'derive-state-checklist',
		async () => {
			const { report, exitCode } = await guidanceJson(root, ['guide', entity]);
			expect(exitCode).toBe(1);
			expect(report.states).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ name: 'default', origin: 'REQUIRED' }),
					expect.objectContaining({ name: 'loading', origin: 'REQUIRED' }),
					expect.objectContaining({ name: 'failed', origin: 'REQUIRED' }),
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
	await attachGuidanceShots(root, ['default']);
	let result = await guidanceJson(root, ['guide', entity]);
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
	const text = await runHarness(['units', 'guide', entity], root);
	expect(text.stdout).toContain('ALL DONE');
	expect(text.stdout).toContain('DONE');
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
