import type { UnitProject } from './unitProject.types';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runHarness } from './cli';

export async function unitProject(kind: 'app' | 'lib'): Promise<UnitProject> {
	const parent = await mkdtemp(join(tmpdir(), `harness-units-${kind}-`));
	await runHarness(['new', kind, 'demo'], parent);
	return projectAt(join(parent, 'demo'));
}

/** A reviewed pure helper shared by two named consumers for registry coverage. */
export async function sharedDateHelperProject(): Promise<UnitProject> {
	const project = await unitProject('lib');
	await project.write(
		'src/helpers/dates/formatDate.ts',
		'/** @pure */\nexport function formatDate(iso: string): string { return new Date(iso).toISOString(); }\n'
	);
	for (const name of ['first', 'second'])
		await project.write(
			`src/utils/${name}.ts`,
			`import { formatDate } from '../helpers/dates/formatDate';\nexport function ${name}(value: string) { return formatDate(value); }`
		);
	await project.harness(['units', 'index', '--write']);
	return project;
}

export function projectAt(root: string): UnitProject {
	const read = (path: string) => readFile(join(root, path), 'utf8');
	const harness = (args: string[], expectSuccess = true) => runHarness(args, root, expectSuccess);
	return {
		root,
		read,
		harness,
		async write(path, contents) {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), contents);
		},
		async json<T>(path: string) {
			return JSON.parse(await read(path)) as T;
		},
		async harnessJson<T>(args: string[]) {
			return JSON.parse((await harness([...args, '--json'])).stdout) as T;
		}
	};
}

export const slugifySource = [
	'export function slugify(input: string, separator = "-"): string {',
	"\tif (!input.trim()) throw new RangeError('input is empty');",
	'\treturn input.trim().toLowerCase().split(/\\s+/).join(separator);',
	'}',
	''
].join('\n');

export const titleServiceSource = [
	"import { slugify } from '../utils/slugify';",
	'',
	'export class TitleService {',
	'\trun(title: string): string {',
	'\t\treturn slugify(title);',
	'\t}',
	'}',
	''
].join('\n');

export const unitLifecycleScenario = {
	schemaVersion: 1,
	id: 'unit-lifecycle',
	title: 'Unit lifecycle',
	kind: 'headless',
	units: ['function.slugify'],
	states: [{ id: 'ready', title: 'Ready', coverage: 'required' }],
	viewports: [],
	tests: [{ id: 'unit', kind: 'unit', runner: 'vitest', target: 'test/slugify.test.ts' }],
	evidence: [{ id: 'output', kind: 'output', states: ['ready'], viewports: [], required: true }]
};

export const utcDateExamples = [
	{
		name: 'UTC date',
		call: 'formatDate("2026-10-20")',
		input: ['2026-10-20'],
		output: '2026-10-20T00:00:00.000Z'
	}
];

export type { UnitProject } from './unitProject.types';
