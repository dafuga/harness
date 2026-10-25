import { expect, test } from 'vitest';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ModuleDataRepository } from '../../../src/repositories/git-source-history/ModuleDataRepository';
import { runCommand } from '../../support/cli';
import { configureTestAuthor, unitProject, validationInvoker } from '../../support/unitProject';

test('historical scenario evidence contracts are reviewed without rewriting source or inventing observations', async () => {
	const project = await unitProject('lib');
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	try {
		await git(['init', '-b', 'main']);
		await configureTestAuthor(project.root);
		await project.write(
			'src/services/TitleService.ts',
			'export class TitleService { run() { return "Title"; } }'
		);
		await project.harness(['units', 'index', '--write']);
		await project.write(
			'specification/scenarios/title-lifecycle.json',
			JSON.stringify({
				schemaVersion: 1,
				id: 'title-lifecycle',
				title: 'Title lifecycle',
				kind: 'headless',
				units: ['service.title'],
				states: [{ id: 'lifecycle', title: 'Read title', coverage: 'required' }],
				viewports: [],
				tests: [
					{ id: 'lifecycle', kind: 'integration', runner: 'vitest', target: 'test/title.test.ts' }
				],
				evidence: []
			})
		);
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: retain historical scenario declaration']);
		const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
		const invoke = validationInvoker(project);
		const before = await invoke(['--write']);
		expect(before.valid).toBe(false);
		expect(before.issues).toContain(
			'title-lifecycle: required state lifecycle has no required evidence'
		);
		const review = join(project.root, '..', 'scenario-review.json');
		const contract = {
			id: 'lifecycle-assertions',
			kind: 'assertions',
			states: ['lifecycle'],
			viewports: [],
			required: true
		};
		const requested = {
			unit: 'service.title',
			reason: 'Declare the wanted lifecycle assertion evidence; no observation is supplied.',
			metadata: { responsibility: 'Serve the title.' },
			scenarios: [{ id: 'title-lifecycle', evidence: [contract] }]
		};
		await project.write('../scenario-review.json', JSON.stringify(requested));
		const repaired = await invoke(['--write', '--review', review]);
		expect(repaired.valid, JSON.stringify(repaired)).toBe(true);
		expect(repaired.committed).toBe(true);
		const repository = new ModuleDataRepository(project.root);
		const stored = await repository.read(await repository.identity(head));
		expect(
			stored?.data.registry.scenarios.find((item) => item.id === 'title-lifecycle')?.evidence
		).toEqual([contract]);
		expect((await invoke(['--write', '--refresh'])).valid).toBe(true);
		expect((await git(['rev-parse', 'HEAD'])).stdout.trim()).toBe(head);
		for (const scenario of [
			{ id: 'absent-scenario', evidence: [contract] },
			{ id: 'title-lifecycle', evidence: [{ ...contract, states: ['unknown-state'] }] }
		]) {
			await project.write(
				'../scenario-review.json',
				JSON.stringify({ ...requested, scenarios: [scenario] })
			);
			const refused = await project.harness(
				['validate', '--write', '--review', review, '--json'],
				false
			);
			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toMatch(/Unknown review scenario|unknown state/);
		}
		expect((await invoke([])).valid).toBe(true);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);
