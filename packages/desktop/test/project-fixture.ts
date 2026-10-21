import { unitManifest } from './project-fixture-units';
import { afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
const roots: string[] = [];
export const text =
	"import { filter } from '../functions/filter';\nexport function owned(input = 'é') { return filter(input); }\n" +
	'// Fixture source for history.\n'.repeat(100);
const definitions = [
	['page.home', 'page', 'src/pages/Home.ts'],
	['reports.component.select', 'component', 'src/components/Select.ts'],
	['function.filter', 'function', 'src/functions/filter.ts'],
	['service.analytics', 'service', 'src/services/Analytics.ts'],
	['config.flags', 'config', 'src/configs/flags.ts']
];
export const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function put(root: string, path: string, content: string) {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), content);
}
function checkFilterExamples(root: string) {
	const declared = JSON.parse(
		readFileSync(join(root, 'specification/units/function.filter.json'), 'utf8')
	) as ReturnType<typeof unitManifest>;
	const examples = declared.helperContracts?.[0].examples;
	if (!examples?.length) throw new Error('Fixture helper examples are missing.');
	const calls = examples.map((example) => example.call).join(', ');
	const program = `import { filter } from './src/functions/filter.ts'; console.log(JSON.stringify([${calls}]));`;
	const actual = execFileSync('bun', ['-e', program], { cwd: root, encoding: 'utf8' }).trim();
	if (actual !== JSON.stringify(examples.map((example) => example.output)))
		throw new Error('Fixture helper examples do not match its implementation.');
}
export async function fixture() {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-project-')));
	roots.push(root);
	git(root, 'init', '-b', 'main');
	git(root, 'config', 'user.name', 'Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'lfs', 'install', '--local');
	for (const [id, kind, path] of definitions) {
		await put(
			root,
			path,
			id === 'function.filter'
				? '/** @pure */\nexport function filter(input: string) { return input.trim(); }\n'
				: text
		);
		await put(root, `specification/units/${id}.json`, JSON.stringify(unitManifest(id, kind, path)));
	}
	checkFilterExamples(root);
	await put(root, 'private.txt', 'PRIVATE_SOURCE_BODY');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'five canonical entities');
	const base = git(root, 'rev-parse', 'HEAD');
	git(root, 'checkout', '-b', 'feature/design');
	await put(root, 'src/components/Select.ts', 'feature branch source');
	checkFilterExamples(root);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'feature source');
	const feature = git(root, 'rev-parse', 'HEAD');
	git(root, 'checkout', 'main');
	await put(
		root,
		'src/functions/filter.ts',
		'/** @pure */\nexport function filter(input: string) { return input.trim().toUpperCase(); }\n'
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'main source');
	const tip = git(root, 'rev-parse', 'HEAD');
	checkFilterExamples(root);
	const session = new ProjectSessionService();
	await session.open(root);
	return { session, base, feature, tip, ...session.requireProject() };
}
