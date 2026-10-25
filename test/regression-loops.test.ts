import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { searchLoops } from '../src/workflows/loopSearch';
import { resolveLoopTemplate } from '../src/workflows/loopTemplates';
import { projectFiles } from '../src/templates/project';
import { findGuide } from '../src/guides/guide';
import { environmentProfile } from '../src/workflows/verification-evidence/record-regression/RegressionProofService';

test('regression profiles ignore volatile macOS launcher identity while retaining workload settings', () => {
	const source = {
		PATH: '/pinned/runtime',
		FEATURE_FLAG: 'enabled',
		XPC_SERVICE_NAME: 'launcher-one'
	};
	const first = environmentProfile(source);
	expect(
		environmentProfile({ ...source, XPC_SERVICE_NAME: 'launcher-two' }),
		'macOS launch identity is not workload configuration'
	).toBe(first);
	expect(environmentProfile({ ...source, PATH: '/another/runtime' })).not.toBe(first);
	expect(environmentProfile({ ...source, FEATURE_FLAG: 'disabled' })).not.toBe(first);
});

const orders = {
	'bug-fix': ['spec', 'coverage', 'red', 'implement', 'green', 'verify'],
	fix: ['spec', 'coverage', 'red', 'implement', 'green', 'verify'],
	'regression-prevention': [
		'spec',
		'coverage',
		'red',
		'propose',
		'implement',
		'green',
		'guard',
		'verify'
	]
};

const standardFormGuidance = [
	'Use exactly these five contract-driven test forms',
	'Pages: Playwright screenshot matches of each declared page state at every required viewport',
	'Components: Playwright screenshot matches of the component at rest, plus each declared interaction and error-prop state.',
	'Helpers: one unit case per authored example, asserting its documented output or error.',
	'Classes: one case per method and declared initialization or lifecycle state, including each declared error.',
	'APIs: structural complete JSON response matches for each supported prop and error matrix row.',
	'Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.',
	'Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.',
	'Unsupported or missing test coverage is an explicit validation failure',
	'Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.'
];

const stableCaseGuidance = [
	'Do not write standalone bug regression tests.',
	"Keep each form's case count fixed.",
	'Add or remove a case only when the contract explicitly changes a capability',
	'Keep registered case titles and identities stable; verification records bind to them.'
];

test.each(Object.entries(orders))(
	'%s exposes ordered proof and project checks',
	async (id, order) => {
		const template = await resolveLoopTemplate(process.cwd(), id);
		expect(template.steps.map((step) => step.id)).toEqual(order);
		expect(template.lineage).toEqual(id === 'fix' ? ['bug-fix', 'fix'] : [id]);
		expect(template.evaluators).toEqual([
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'verify'
			}
		]);
		expect(template.steps.find((step) => step.id === 'red')?.title).toContain('failing');
		expect(template.steps.find((step) => step.id === 'coverage')?.title).toMatch(
			/why.*existing.*tests.*missed/i
		);
		expect(template.steps.find((step) => step.id === 'red')?.title).toContain(
			'existing standardized test'
		);
		expect(template.steps.find((step) => step.id === 'green')?.title).toContain('same unchanged');
		expect(template.steps.find((step) => step.id === 'red')?.title).toContain('commit');
		expect(template.steps.find((step) => step.id === 'green')?.title).toContain(
			'separate fix commit'
		);
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
		expect(template.steps.find((step) => step.id === 'guard')?.title).toContain('project guard');
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
			expect(text).toMatch(/why.*existing.*tests.*missed/i);
			expect(text).toContain('existing standardized test');
			expect(text).toContain('one-off');
			expect(text).toContain('missing coverage category');
			expect(text).toContain('commit the failing test');
			expect(text).toContain('separate fix commit');
			expect(text).toContain('loop record');
			expect(text).toContain('parameter names describe their domain role');
			expect(text).toContain('earliest responsible generator, skill or review checkpoint');
			expect(text).toContain('one selected callable per detail page');
			expect(text).toContain('src/configs/<category>/');
			for (const term of [...standardFormGuidance, ...stableCaseGuidance]) {
				expect(text).toContain(term);
			}
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
		'reintroducing',
		'existing standardized test',
		'coverage gap',
		'one-off',
		'separate fix commit',
		'loop record'
	]) {
		expect(guide).toContain(term);
	}
});
