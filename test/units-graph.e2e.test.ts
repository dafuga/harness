import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { slugifySource, titleServiceSource, unitProject } from './support/unitProject';

interface Graph {
	nodes: Array<{ id: string; kind: string; unit?: string }>;
	edges: Array<{ from: string; to: string; via: string }>;
	uncertain: Array<{ node: string; reason: string; detail: string }>;
}

const loaderSource = [
	'export class LoaderService {',
	'\tasync known(): Promise<unknown> {',
	"\t\treturn import('../utils/slugify');",
	'\t}',
	'\tasync named(name: string): Promise<unknown> {',
	'\t\treturn import(name);',
	'\t}',
	'}',
	''
].join('\n');

const decoySource = [
	"import { missing } from './missing';",
	'// import { ignored } from "../services/TitleService";',
	'export const template = `import { fake } from "../services/LoaderService";`;',
	'export const pattern = /[\'"]\\/\\/ not a comment/;',
	"export const worker = new URL('../services/TitleService.ts', import.meta.url);",
	'export const value = missing;',
	''
].join('\n');

test('source graph resolves imports, re-exports, dynamic imports and Svelte scripts', async () => {
	const project = await unitProject('app');
	await project.write('src/utils/slugify.ts', slugifySource);
	await project.write('src/services/TitleService.ts', titleServiceSource);
	await project.write('src/services/LoaderService.ts', loaderSource);
	await project.write('src/lib/titles.ts', "export { slugify } from '../utils/slugify';\n");
	await project.write(
		'src/components/TitleCard.svelte',
		[
			'<script lang="ts">',
			"\timport { slugify } from '../lib/titles';",
			'\tlet { title }: { title: string } = $props();',
			'</script>',
			'',
			'<h2>{slugify(title)}</h2>',
			''
		].join('\n')
	);
	await project.write(
		'test/services/title.test.ts',
		"import { TitleService } from '../../src/services/TitleService';\nexport const subject = TitleService;\n"
	);
	await project.harness(['units', 'index', '--write']);
	const graph = await project.harnessJson<Graph>(['units', 'graph']);
	const edge = (from: string, to: string) =>
		graph.edges.find((item) => item.from === `file:${from}` && item.to === `file:${to}`)?.via;

	expect(edge('src/services/TitleService.ts', 'src/utils/slugify.ts')).toBe('import');
	expect(edge('src/lib/titles.ts', 'src/utils/slugify.ts')).toBe('reexport');
	expect(edge('src/services/LoaderService.ts', 'src/utils/slugify.ts')).toBe('dynamic-import');
	expect(edge('src/components/TitleCard.svelte', 'src/lib/titles.ts')).toBe('import');
	expect(edge('test/services/title.test.ts', 'src/services/TitleService.ts')).toBe('import');
	expect(graph.nodes).toContainEqual({
		id: 'file:src/services/TitleService.ts',
		kind: 'source',
		unit: 'service.title'
	});
	expect(graph.nodes).toContainEqual({ id: 'file:test/services/title.test.ts', kind: 'test' });
	expect(graph.edges).toContainEqual({
		from: 'unit:service.title',
		to: 'file:src/services/TitleService.ts',
		via: 'owns'
	});
	expect(graph.uncertain).toContainEqual({
		node: 'file:src/services/LoaderService.ts',
		reason: 'non-literal-import',
		detail: 'import(name)'
	});
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);

test('unresolved references are uncertain and text inside strings or comments is not a reference', async () => {
	const project = await unitProject('lib');
	await project.write('src/services/TitleService.ts', 'export class TitleService {}\n');
	await project.write('src/services/LoaderService.ts', 'export class LoaderService {}\n');
	await project.write('src/utils/decoy.ts', decoySource);
	await project.harness(['units', 'index', '--write']);
	const graph = await project.harnessJson<Graph>(['units', 'graph']);
	const from = graph.edges.filter((item) => item.from === 'file:src/utils/decoy.ts');

	expect(from).toEqual([
		{ from: 'file:src/utils/decoy.ts', to: 'file:src/services/TitleService.ts', via: 'url' }
	]);
	expect(graph.uncertain).toContainEqual({
		node: 'file:src/utils/decoy.ts',
		reason: 'unresolved-import',
		detail: './missing'
	});
	const check = await project.harness(['units', 'check']);
	expect(check.stdout).toContain('1 uncertain reference');
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);
