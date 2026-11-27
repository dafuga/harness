import { rm } from 'node:fs/promises';
import { afterEach, expect, test } from 'vitest';
import { runHarness } from './support/cli';
import { measureWorkload } from './support/measureWorkload';
import { motionRegistryProject, assertPartialVideoRegistry } from './support/partialVideoRegistry';
import {
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
async function project() {
	const root = await guidanceProject(['default']);
	roots.push(root);
	return root;
}

function incompleteWidget() {
	const unit = widgetManifest();
	unit.contract.inputs = [
		{ name: 'Widget.title', type: 'string' },
		{ name: 'Widget.label', type: 'string', required: false },
		{ name: 'Widget.mode', type: "'loading' | 'failed'", required: true }
	];
	unit.contract.errorStatus = 'unknown';
	unit.contract.operations = [
		{ name: 'Widget.retry', inputs: [], outputs: [], errors: [], errorStatus: 'unknown' }
	];
	unit.contract.snippets = [
		{ name: 'Widget.children', inputs: [], outputs: [], errors: [], errorStatus: 'unknown' }
	];
	return unit;
}

test('check-contract reports every heuristic finding with identity, detail and location', async () => {
	const root = await project();
	const unit = incompleteWidget();
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	await writeGuidanceFile(
		root,
		'src/components/Widget.svelte',
		`<script lang="ts">let { title, label, mode, disabled = false }: { title: string; label?: string; mode: 'loading' | 'failed' | 'empty'; disabled?: boolean } = $props();\nexport function retry(): number { throw new RangeError('retry failed'); }</script>\n{#snippet children()}hello{/snippet}{#if mode === 'empty'}empty{/if}`
	);
	await writeGuidanceFile(
		root,
		'widget-required-states.json',
		JSON.stringify({ [entity]: ['default'] })
	);
	await measureWorkload(
		'workflow.development-tooling-check-unit-contracts',
		'audit-contract-findings',
		async () => {
			const { report, exitCode } = await guidanceJson(root, [
				'check-contract',
				entity,
				'--required-states',
				'widget-required-states.json'
			]);
			expect(exitCode).toBe(1);
			expect(report.findings.map((finding: { kind: string }) => finding.kind)).toEqual(
				expect.arrayContaining([
					'missing-required',
					'missing-default',
					'missing-errors',
					'missing-output',
					'undocumented-prop',
					'undocumented-state',
					'untested-state',
					'required-states-incomplete'
				])
			);
			for (const finding of report.findings)
				expect(finding).toMatchObject({
					entity,
					kind: expect.any(String),
					detail: expect.any(String),
					where: expect.any(String)
				});
		}
	);
});

test('check-contract accepts explicit none errors, outputs and complete state coverage', async () => {
	const root = await motionRegistryProject();
	roots.push(root);
	const { report, exitCode } = await guidanceJson(root, ['check-contract', entity]);
	expect(exitCode).toBe(0);
	expect(report).toMatchObject({
		findings: [],
		counts: [{ entity, findings: 0 }],
		summary: { entities: 1, findings: 0 }
	});
	await assertPartialVideoRegistry(root);
});

test('native element atoms skip guesses but retain explicitly required state gaps', async () => {
	const root = await project();
	const unit = widgetManifest();
	unit.contract.inputs = [
		{ name: 'Widget.children', type: 'Snippet', required: false, defaultKind: 'omitted' }
	];
	unit.contract.errors = [{ name: 'Caller content error', type: 'propagated' }];
	for (const element of ['div', 'svg', undefined]) {
		unit.composition = { level: 'atom', ...(element ? { element } : {}) };
		await writeGuidanceFile(
			root,
			'specification/units/component.widget.json',
			JSON.stringify(unit)
		);
		const { report } = await measureWorkload(
			'workflow.development-tooling-check-unit-contracts',
			'native-and-custom-atom-states',
			() => guidanceJson(root, ['check-contract', entity])
		);
		if (element) expect(report.findings, element).toEqual([]);
		else
			expect(report.findings).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						kind: 'untested-state',
						detail: expect.stringContaining('without-children')
					}),
					expect.objectContaining({
						kind: 'untested-state',
						detail: expect.stringContaining('error')
					})
				])
			);
	}
	unit.composition = { level: 'atom', element: 'div' };
	unit.contract.inputs.push({ name: 'Widget.mode', type: "'base' | 'active'", required: true });
	unit.contract.outputs[0].description = 'Renders base or active content.';
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	const { report } = await guidanceJson(root, ['check-contract', entity]);
	expect(report.findings).toContainEqual(
		expect.objectContaining({
			kind: 'untested-state',
			detail: expect.stringContaining('active (REQUIRED)')
		})
	);
	expect(
		report.findings.some((finding: { detail: string }) => finding.detail.includes('(GUESS)'))
	).toBe(false);
});

test('check-contract --all summarises active identities without hiding findings', async () => {
	const root = await project();
	const second = {
		...widgetManifest(),
		id: 'component.other',
		contract: { ...widgetManifest().contract, inputs: [{ name: 'Other.prop', type: 'string' }] }
	};
	await writeGuidanceFile(root, 'specification/units/component.other.json', JSON.stringify(second));
	const { report, exitCode } = await guidanceJson(root, ['check-contract', '--all']);
	expect(exitCode).toBe(1);
	expect(report.summary.entities).toBeGreaterThanOrEqual(2);
	expect(report.counts).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ entity, findings: 0 }),
			expect.objectContaining({ entity: 'component.other', findings: expect.any(Number) })
		])
	);
	expect(report.summary.findings).toBe(report.findings.length);
	const text = await runHarness(['units', 'check-contract', '--all'], root, false);
	expect(text.stdout).toContain('component.other');
	expect(text.stdout).toContain('missing-required');
});

test('required-state files and other support registries retain the entity boundary', async () => {
	const root = await project();
	await writeGuidanceFile(
		root,
		'packages/other/tests/e2e/support/previewScenarios.ts',
		`export const previews = [{ entity: '${entity}', states: ['disabled'] }, { entity: 'component.other', states: ['unrelated'] }];`
	);
	const unit = widgetManifest();
	unit.contract.inputs = [{ name: 'Widget.mode', type: "'loading' | 'failed'", required: true }];
	await writeGuidanceFile(root, 'specification/units/component.widget.json', JSON.stringify(unit));
	await writeGuidanceFile(
		root,
		'specification/widget-required-states.json',
		JSON.stringify({ [entity]: ['default', 'loading'], 'component.other': ['unrelated'] })
	);
	const { report } = await guidanceJson(root, ['check-contract', entity]);
	expect(report.findings).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				kind: 'undocumented-state',
				detail: expect.stringContaining('disabled')
			}),
			expect.objectContaining({
				kind: 'required-states-incomplete',
				where: expect.stringContaining('required-states.json')
			})
		])
	);
	expect(JSON.stringify(report.findings)).not.toContain('unrelated');
});

test('check-contract validates selectors and refuses an unreadable required-state file', async () => {
	const root = await project();
	for (const args of [
		[],
		[entity, '--all'],
		['component.missing'],
		[entity, '--required-states', 'absent-required-states.json']
	]) {
		const result = await runHarness(['units', 'check-contract', ...args], root, false);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toMatch(/Select|Unknown unit|Cannot read/);
	}
});
