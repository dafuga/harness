import { expect } from 'vitest';
import type { UnitProject } from './unitProject.types';
import type { Shown } from '../units-policy.e2e.test.types';

export async function writeAttribution(project: UnitProject): Promise<void> {
	await project.write(
		'src/utils/slugify.ts',
		(await project.read('src/utils/slugify.ts')) +
			'\nexport class SlugifyFailure extends Error {}\n'
	);
	await project.write(
		'src/utils/slugify.types.ts',
		'export interface SlugifyOptions { lower?: boolean }\n'
	);
	await project.write('src/utils/forward.ts', "export { slugify } from './slugify';\n");
	await project.write('test/direct.test.ts', "import { slugify } from '../src/utils/slugify';\n");
	await project.write(
		'test/transitive.test.ts',
		"import { slugify } from '../src/utils/forward';\n"
	);
	await project.write(
		'test/types.test.ts',
		"import type { slugify } from '../src/utils/slugify';\n"
	);
	await project.write(
		'specification/scenarios/slugify.json',
		JSON.stringify({
			schemaVersion: 1,
			id: 'slugify',
			title: 'Slugify',
			kind: 'headless',
			units: ['function.slugify'],
			states: [{ id: 'ready', title: 'Ready', coverage: 'required' }],
			viewports: [],
			tests: [{ id: 'direct', kind: 'unit', runner: 'vitest', target: 'test/direct.test.ts' }],
			evidence: [{ id: 'result', kind: 'output', states: ['ready'], viewports: [], required: true }]
		})
	);
}

export function assertAttribution(shown: Shown): void {
	expect(shown.declarations).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ name: 'slugify', role: 'operation' }),
			expect.objectContaining({ name: 'SlugifyFailure', role: 'runtime-support' }),
			expect.objectContaining({ name: 'SlugifyOptions', role: 'type' })
		])
	);
	expect(shown.tests).toEqual([
		'test/direct.test.ts',
		'test/transitive.test.ts',
		'test/types.test.ts'
	]);
	expect(
		shown.testAttribution?.directImports.map(({ file, dependency }) => [file, dependency])
	).toEqual([
		['test/direct.test.ts', 'runtime'],
		['test/types.test.ts', 'type-only']
	]);
	expect(shown.testAttribution?.transitiveImpacts[0]).toMatchObject({
		file: 'test/transitive.test.ts',
		dependency: 'runtime',
		path: [
			{ from: 'file:test/transitive.test.ts', to: 'file:src/utils/forward.ts' },
			{ from: 'file:src/utils/forward.ts', to: 'file:src/utils/slugify.ts' }
		]
	});
	expect(shown.testAttribution?.scenarios[0]).toMatchObject({
		id: 'slugify',
		tests: [{ target: 'test/direct.test.ts' }]
	});
}
