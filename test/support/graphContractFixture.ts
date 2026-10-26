import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentManifest } from '../../src/core/unitTypes';
import { runCommand } from './cli';
import type { UnitProject } from './unitProject';

const testFile = 'test/graph-cases.test.ts';
const fixtureTest = `import { expect, test } from 'vitest';
import { TitleService } from '../src/services/TitleService';
import { LoaderService } from '../src/services/LoaderService';
import { readDecoy } from '../src/utils/decoy';
import title from '../specification/units/service.title.json';
import loader from '../specification/units/service.loader.json';
import decoy from '../specification/units/function.decoy.json';

test('TitleService.label initialized', () => {
	expect(new TitleService().label()).toEqual(title.testing.cases[0].expected.value);
});
test('LoaderService.label initialized', () => {
	expect(new LoaderService().label()).toEqual(loader.testing.cases[0].expected.value);
});
test('readDecoy: fixture value', () => {
	expect(readDecoy()).toEqual(decoy.testing.examples[0].expected.value);
});
`;

/** Preserve the unresolved source import while providing its explicit runtime fixture to Vitest. */
export async function prepareGraphContracts(project: UnitProject): Promise<void> {
	await project.write(testFile, fixtureTest);
	await project.write('test/support/graphMissing.ts', "export const missing = 'fixture';\n");
	const config = await project.read('vitest.config.ts');
	const marker = 'export default defineConfig({ test:';
	if (!config.includes(marker)) throw new Error('Generated library Vitest config changed');
	const alias = JSON.stringify(join(project.root, 'test/support/graphMissing.ts'));
	await project.write(
		'vitest.config.ts',
		config.replace(
			marker,
			`export default defineConfig({ resolve: { alias: { './missing': ${alias} } }, test:`
		)
	);
	await classContract(project, 'service.title', 'TitleService.label', 'title');
	await classContract(project, 'service.loader', 'LoaderService.label', 'loader');
	await helperContract(project);
	await project.harness(['units', 'index', '--write']);
	await symlink(join(process.cwd(), 'node_modules'), join(project.root, 'node_modules'), 'dir');
}

async function classContract(
	project: UnitProject,
	id: string,
	subject: string,
	value: string
): Promise<void> {
	const path = `specification/units/${id}.json`;
	const unit = await project.json<ComponentManifest>(path);
	const testing: ComponentManifest['testing'] = {
		version: 1,
		shape: 'service',
		states: ['initialized'],
		cases: [
			{
				id: 'label.initialized',
				state: 'initialized',
				subject,
				test: { file: testFile, title: `${subject} initialized` },
				expected: { kind: 'value', value }
			}
		]
	};
	await project.write(path, JSON.stringify({ ...unit, testing }));
}

async function helperContract(project: UnitProject): Promise<void> {
	const path = 'specification/units/function.decoy.json';
	const unit = await project.json<ComponentManifest>(path);
	const testing: ComponentManifest['testing'] = {
		version: 1,
		shape: 'helper',
		states: ['default'],
		examples: [
			{
				subject: 'readDecoy',
				name: 'fixture value',
				call: 'readDecoy()',
				input: [],
				expected: { kind: 'value', value: 'fixture' }
			}
		],
		cases: [
			{
				id: 'fixture.default',
				state: 'default',
				subject: 'readDecoy',
				example: 'fixture value',
				test: { file: testFile, title: 'readDecoy: fixture value' }
			}
		]
	};
	await project.write(path, JSON.stringify({ ...unit, testing }));
}

/** Execute all declared fixture cases; the error from a failed case reaches the parent E2E. */
export async function runGraphContracts(project: UnitProject): Promise<void> {
	await runCommand(
		['bun', 'x', 'vitest', 'run', testFile, '--maxWorkers=1', '--minWorkers=1'],
		project.root
	);
}
