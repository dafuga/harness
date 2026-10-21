import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runHarness } from './cli';

export interface UnitProject {
	root: string;
	write(path: string, contents: string): Promise<void>;
	read(path: string): Promise<string>;
	json<T = Record<string, unknown>>(path: string): Promise<T>;
	harness(args: string[], expectSuccess?: boolean): ReturnType<typeof runHarness>;
	harnessJson<T = Record<string, unknown>>(args: string[]): Promise<T>;
}

export async function unitProject(kind: 'app' | 'lib'): Promise<UnitProject> {
	const parent = await mkdtemp(join(tmpdir(), `harness-units-${kind}-`));
	await runHarness(['new', kind, 'demo'], parent);
	return projectAt(join(parent, 'demo'));
}

/** A reviewed pure helper shared by two named consumers for registry coverage. */
export async function sharedDateHelperProject(): Promise<UnitProject> {
	const project = await unitProject('lib');
	await project.write(
		'src/utils/formatDate.ts',
		'/** @pure */\nexport function formatDate(iso: string): string { return new Date(iso).toISOString(); }\n'
	);
	for (const name of ['first', 'second'])
		await project.write(
			`src/utils/${name}.ts`,
			`import { formatDate } from './formatDate';\nexport function ${name}(value: string) { return formatDate(value); }`
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
