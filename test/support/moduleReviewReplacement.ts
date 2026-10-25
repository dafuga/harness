import { ModuleDataRepository } from '../../src/repositories/git-source-history/ModuleDataRepository';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import type { UnitProject } from './unitProject.types';
import { validationInvoker } from './unitProject';
import { runCommand } from './cli';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

export async function replacedReviewContracts(project: UnitProject) {
	const original = await project.json<ComponentManifest>('specification/units/service.title.json');
	const contract = globalThis.structuredClone(original.contract);
	contract.origin = 'declared';
	contract.outputs[0].description = 'Return the normalized title reviewed at this source revision.';
	await review(project, 'service.title', {
		contract,
		responsibility: 'Serve titles using the first reviewed metadata.'
	});
	await review(project, 'service.title', {
		responsibility: 'Serve titles using the replacement reviewed metadata.'
	});
	const cached = (await declaration(project, 'service.title')).contract;
	await validationInvoker(project)(['--refresh', '--write']);
	return { cached, refreshed: (await declaration(project, 'service.title')).contract };
}

export async function replacedReviewPreviews(project: UnitProject) {
	const path = 'specification/units/component.titles.json';
	const manifest = await project.json<ComponentManifest>(path);
	manifest.preview = { scenario: 'obsolete', state: 'missing', viewport: 'desktop' };
	await project.write(path, JSON.stringify(manifest));
	await project.write(
		'specification/scenarios/component-catalog-previews.json',
		JSON.stringify({
			schemaVersion: 1,
			id: 'component-catalog-previews',
			title: 'Title component',
			kind: 'ui',
			units: ['component.titles'],
			states: [
				{
					id: 'component-titles',
					title: 'Titles',
					coverage: 'required',
					units: ['component.titles']
				}
			],
			viewports: [{ id: 'desktop', width: 920, height: 700 }],
			tests: [{ id: 'titles', kind: 'unit', runner: 'vitest', target: 'test/titles.test.ts' }],
			evidence: [
				{
					id: 'screen',
					kind: 'screenshot',
					states: ['component-titles'],
					viewports: ['desktop'],
					required: true
				}
			]
		})
	);
	await project.write(
		'test/titles.test.ts',
		"import { test, expect } from 'vitest';\nimport { readFileSync } from 'node:fs';\ntest('title markup', () => expect(readFileSync('src/components/Titles.svelte', 'utf8')).toContain('<div>Titles</div>'));\n"
	);
	await runCommand(['git', 'add', '.'], project.root);
	await runCommand(['git', 'commit', '-m', 'feat: retain an obsolete title preview'], project.root);
	await validationInvoker(project)(['--write']);
	await review(project, 'component.titles', { preview: null });
	const cached = (await declaration(project, 'component.titles')).preview;
	await validationInvoker(project)(['--refresh', '--write']);
	return { cached, refreshed: (await declaration(project, 'component.titles')).preview };
}

async function review(project: UnitProject, unit: string, metadata: unknown) {
	const path = join(project.root, '..', 'replacement-review.json');
	await writeFile(
		path,
		JSON.stringify({ unit, reason: 'Review metadata against the exact owned source.', metadata })
	);
	await validationInvoker(project)(['--review', path, '--write']);
}

async function declaration(project: UnitProject, id: string) {
	const repository = new ModuleDataRepository(project.root);
	const held = (await repository.read(await repository.identity('HEAD')))!;
	return held.data.declarations.find((unit) => unit.id === id)!;
}

export function historicalSlugifyContract() {
	return [
		{
			name: 'slugify',
			source: 'src/utils/slugify.ts',
			inputs: [{ name: 'input', type: 'string' }],
			output: 'string',
			pure: true,
			consumers: [{ unit: 'function.first' }, { unit: 'function.second' }],
			examples: [
				{
					name: 'Normalize a title',
					call: 'slugify("Hello World")',
					input: ['Hello World'],
					output: 'hello-world'
				}
			]
		}
	];
}
