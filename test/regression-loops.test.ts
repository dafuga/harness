import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { searchLoops } from '../src/workflows/loopSearch';
import { resolveLoopTemplate } from '../src/workflows/loopTemplates';
import { projectFiles } from '../src/templates/project';
import { findGuide } from '../src/guides/guide';

const orders = {
	'bug-fix': ['spec', 'red', 'implement', 'green', 'verify'],
	'regression-prevention': ['spec', 'red', 'propose', 'implement', 'green', 'guard', 'verify']
};

test.each(Object.entries(orders))(
	'%s exposes ordered proof and project checks',
	async (id, order) => {
		const template = await resolveLoopTemplate(process.cwd(), id);
		expect(template.steps.map((step) => step.id)).toEqual(order);
		expect(template.lineage).toEqual([id]);
		expect(template.evaluators).toEqual([
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'verify'
			}
		]);
		expect(template.steps.find((step) => step.id === 'red')?.title).toContain('failing');
		expect(template.steps.find((step) => step.id === 'green')?.title).toContain('same unchanged');
		expect((await searchLoops({ query: id })).map((item) => item.id)).toContain(id);
	}
);

test('project templates can extend regression prevention and override its guard', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-regression-template-'));
	try {
		await mkdir(join(root, 'specification/loop-templates'), { recursive: true });
		await writeFile(
			join(root, 'specification/loop-templates/custom.json'),
			JSON.stringify({
				id: 'custom',
				title: 'Custom',
				summary: 'Custom prevention.',
				extends: 'regression-prevention',
				steps: [{ id: 'guard', title: 'Prove the project guard rejects the defect.' }]
			})
		);
		const template = await resolveLoopTemplate(root, 'custom');
		expect(template.lineage).toEqual(['regression-prevention', 'custom']);
		expect(template.steps.map((step) => step.id)).toEqual(orders['regression-prevention']);
		expect(template.steps[5].title).toContain('project guard');
		expect(template.evaluators[0].command).toBe('bun run check');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test.each(['app', 'lib'] as const)(
	'generated %s guidance selects loops and explains retries',
	(kind) => {
		const files = projectFiles({ kind, name: 'regression-proof' });
		for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
			const text = files.find((file) => file.path === path)?.contents;
			expect(text).toContain('bug-fix');
			expect(text).toContain('regression-prevention');
			expect(text).toContain('pending');
			expect(text).toContain('reintroducing');
			expect(text).toContain('screenshots');
		}
	}
);

test('loop guide explains red-green evidence, prevention guards, and agent retries', () => {
	const guide = JSON.stringify(findGuide('loop'));
	for (const term of [
		'bug-fix',
		'regression-prevention',
		'unchanged',
		'pending',
		'reintroducing'
	]) {
		expect(guide).toContain(term);
	}
});
