import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { evaluateLoop } from '../src/workflows/loopEvaluate';
import { nextLoopStep } from '../src/workflows/loopNext';
import { searchLoops } from '../src/workflows/loopSearch';
import { resolveLoopTemplate } from '../src/workflows/loopTemplates';
import { completeLoopStep, createLoop } from '../src/workflows/manageLoop';

test('loop templates inherit parent steps and override by id', async () => {
	const root = await tempRoot('harness-loop-template-');
	try {
		const template = await resolveLoopTemplate(root, 'fix');

		expect(template.lineage).toEqual(['feature', 'fix']);
		expect(template.steps.map((step) => step.id)).toEqual(['spec', 'implement', 'test', 'verify']);
		expect(template.steps[0].title).toContain('failing behavior');
		expect(template.evaluators[0]).toMatchObject({ id: 'check', step: 'verify' });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('project loop templates extend built-ins and append child steps', async () => {
	const root = await tempRoot('harness-loop-project-template-');
	try {
		await writeTemplate(root, 'custom', {
			id: 'custom',
			title: 'Custom Fix',
			summary: 'A project-specific fix loop.',
			extends: 'fix',
			steps: [
				{ id: 'test', title: 'Add regression coverage.' },
				{ id: 'release', title: 'Prepare release notes.' }
			],
			evaluators: [{ id: 'release-note', title: 'Check notes.', command: 'bun --version' }]
		});

		const template = await resolveLoopTemplate(root, 'custom');

		expect(template.steps.map((step) => step.id)).toEqual([
			'spec',
			'implement',
			'test',
			'verify',
			'release'
		]);
		expect(template.steps[2].title).toBe('Add regression coverage.');
		expect(template.evaluators.map((evaluator) => evaluator.id)).toEqual(['check', 'release-note']);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('loop template resolution rejects inheritance cycles', async () => {
	const root = await tempRoot('harness-loop-cycle-');
	try {
		await writeTemplate(root, 'alpha', {
			id: 'alpha',
			title: 'Alpha',
			summary: 'Alpha loop.',
			extends: 'beta',
			steps: []
		});
		await writeTemplate(root, 'beta', {
			id: 'beta',
			title: 'Beta',
			summary: 'Beta loop.',
			extends: 'alpha',
			steps: []
		});

		await expect(resolveLoopTemplate(root, 'alpha')).rejects.toThrow('inheritance cycle');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('loop search includes templates and existing loop instances', async () => {
	const root = await tempRoot('harness-loop-search-');
	try {
		await createLoop({ root, name: 'search-proof', goal: 'Prove search works', from: 'feature' });

		const results = await searchLoops({ root, query: 'search' });

		expect(results.map((result) => `${result.kind}:${result.id}`)).toContain('loop:search-proof');
		expect((await searchLoops({ root, query: 'feature' })).map((result) => result.id)).toContain(
			'feature'
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('next loop step returns the related evaluator', async () => {
	const root = await tempRoot('harness-loop-next-');
	try {
		await createLoop({ root, name: 'next-proof', goal: 'Prove next works', from: 'feature' });
		await completeLoopStep({ root, loop: 'next-proof', step: 'spec', evidence: 'Scoped' });
		await completeLoopStep({ root, loop: 'next-proof', step: 'implement', evidence: 'Built' });
		await completeLoopStep({ root, loop: 'next-proof', step: 'test', evidence: 'Covered' });

		const next = await nextLoopStep({ root, loop: 'next-proof' });

		expect(next.step?.id).toBe('verify');
		expect(next.evaluator?.command).toBe('bun run check');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('loop evaluators report passing and failing commands', async () => {
	const root = await tempRoot('harness-loop-evaluate-');
	try {
		await writeTemplate(root, 'pass', evaluatorTemplate('pass', 'bun --version'));
		await writeTemplate(root, 'fail', evaluatorTemplate('fail', 'bun -e "process.exit(2)"'));
		await createLoop({ root, name: 'pass-loop', goal: 'Passes', from: 'pass' });
		await createLoop({ root, name: 'fail-loop', goal: 'Fails', from: 'fail' });

		const passed = await evaluateLoop({ root, loop: 'pass-loop' });
		const failed = await evaluateLoop({ root, loop: 'fail-loop' });

		expect(passed.passed).toBe(true);
		expect(failed.passed).toBe(false);
		expect(failed.results[0].exitCode).toBe(2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

function evaluatorTemplate(id: string, command: string): Record<string, unknown> {
	return {
		id,
		title: `${id} template`,
		summary: `${id} evaluator template.`,
		steps: [{ id: 'verify', title: 'Run evaluator.' }],
		evaluators: [{ id: 'command', title: 'Run command.', command, step: 'verify' }]
	};
}

async function tempRoot(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

async function writeTemplate(
	root: string,
	name: string,
	template: Record<string, unknown>
): Promise<void> {
	const dir = join(root, 'specification', 'loop-templates');
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, `${name}.json`), JSON.stringify(template, null, '\t'));
}
