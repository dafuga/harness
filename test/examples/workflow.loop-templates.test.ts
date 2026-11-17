import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	listLoopTemplates,
	resolveLoopTemplate
} from '../../src/workflows/development-tooling/loop-templates/loopTemplates';
import type {
	LoopTemplate,
	ResolvedLoopTemplate
} from '../../src/workflows/development-tooling/loop-templates/loopTemplates.types';

const checkTemplate: LoopTemplate = {
	id: 'project-check',
	title: 'Project check',
	summary: 'Checks the project.',
	steps: [{ id: 'verify', title: 'Verify' }]
};

const baseTemplate: LoopTemplate = {
	id: 'base',
	title: 'Base',
	summary: 'Base loop.',
	steps: [
		{ id: 'plan', title: 'Plan' },
		{ id: 'verify', title: 'Verify' }
	],
	evaluators: [{ id: 'lint', title: 'Lint', command: 'bun run lint' }]
};

const releaseTemplate: LoopTemplate = {
	id: 'release',
	title: 'Release',
	summary: 'Release loop.',
	extends: 'base',
	steps: [
		{ id: 'verify', title: 'Verify release' },
		{ id: 'ship', title: 'Ship' }
	],
	evaluators: [{ id: 'smoke', title: 'Smoke', command: 'bun run smoke', step: 'ship' }]
};

function writeProjectTemplate(root: string, name: string, content: string): void {
	const dir = join(root, 'specification', 'loop-templates');
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${name}.json`), content);
}

async function captureError(run: () => Promise<unknown>): Promise<{ name: string; message: string }> {
	try {
		await run();
	} catch (error) {
		const failure = error as Error;
		return { name: failure.name, message: failure.message };
	}
	throw new Error('Expected the call to reject');
}

test('Lists project templates after built-in templates', async () => {
	await withTempDir('loop-templates-list-', async (root) => {
		writeProjectTemplate(root, 'project-check', JSON.stringify(checkTemplate));
		const templates = await listLoopTemplates(root);
		const last = templates[templates.length - 1];
		expect(last).toEqual({ ...checkTemplate, evaluators: [], source: 'project' });
		expect(templates.slice(0, -1).every((template) => template.source === 'built-in')).toBe(true);
		recordExampleCases(
			{
				unitId: 'workflow.loop-templates',
				symbol: 'listLoopTemplates',
				state: 'lists-project-templates-after-built-in-templates',
				evidence: 'examples-cases',
				file: 'lists-project-templates-after-built-in-templates.json'
			},
			[
				{
					name: 'project file appended after built-in templates with source project',
					input: { root: 'temporary project with specification/loop-templates/project-check.json' },
					output: { lastTemplate: last }
				}
			]
		);
	});
});

test('Resolves a child template by merging parent steps', async () => {
	await withTempDir('loop-templates-resolve-', async (root) => {
		writeProjectTemplate(root, 'base', JSON.stringify(baseTemplate));
		writeProjectTemplate(root, 'release', JSON.stringify(releaseTemplate));
		const resolved: ResolvedLoopTemplate = await resolveLoopTemplate(root, 'release');
		expect(resolved.lineage).toEqual(['base', 'release']);
		expect(resolved.steps).toEqual([
			{ id: 'plan', title: 'Plan' },
			{ id: 'verify', title: 'Verify release' },
			{ id: 'ship', title: 'Ship' }
		]);
		expect(resolved.evaluators.map((evaluator) => evaluator.id)).toEqual(['lint', 'smoke']);
		recordExampleCases(
			{
				unitId: 'workflow.loop-templates',
				symbol: 'resolveLoopTemplate',
				state: 'resolves-a-child-template-by-merging-parent-steps',
				evidence: 'examples-cases',
				file: 'resolves-a-child-template-by-merging-parent-steps.json'
			},
			[
				{
					name: 'child verify step replaces parent and ship step is appended',
					input: { id: 'release', extends: 'base' },
					output: resolved
				}
			]
		);
	});
});

test('Rejects an inheritance cycle between templates', async () => {
	await withTempDir('loop-templates-cycle-', async (root) => {
		writeProjectTemplate(root, 'cycle-a', JSON.stringify({ id: 'cycle-a', title: 'A', summary: 'A.', extends: 'cycle-b', steps: [] }));
		writeProjectTemplate(root, 'cycle-b', JSON.stringify({ id: 'cycle-b', title: 'B', summary: 'B.', extends: 'cycle-a', steps: [] }));
		const error = await captureError(() => resolveLoopTemplate(root, 'cycle-a'));
		expect(error.message).toContain('inheritance cycle');
		recordExampleCases(
			{
				unitId: 'workflow.loop-templates',
				symbol: 'resolveLoopTemplate',
				state: 'rejects-an-inheritance-cycle-between-templates',
				evidence: 'examples-cases',
				file: 'rejects-an-inheritance-cycle-between-templates.json'
			},
			[
				{
					name: 'cycle-a extends cycle-b which extends cycle-a',
					input: { id: 'cycle-a' },
					error
				}
			]
		);
	});
});

test('Rejects invalid JSON in a project template file', async () => {
	await withTempDir('loop-templates-json-', async (root) => {
		writeProjectTemplate(root, 'broken', '{ "id": ');
		const error = await captureError(() => listLoopTemplates(root));
		expect(error.name).toBe('SyntaxError');
		recordExampleCases(
			{
				unitId: 'workflow.loop-templates',
				symbol: 'listLoopTemplates',
				state: 'rejects-invalid-json-in-a-project-template-file',
				evidence: 'examples-cases',
				file: 'rejects-invalid-json-in-a-project-template-file.json'
			},
			[
				{
					name: 'truncated broken.json rejects while parsing',
					input: { root: 'temporary project with specification/loop-templates/broken.json' },
					error
				}
			]
		);
	});
});
