import { afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
const roots: string[] = [];
export const text = 'export const owned = "é";\n'.repeat(100);
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
export async function fixture() {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'harness-project-')));
	roots.push(root);
	git(root, 'init', '-b', 'main');
	git(root, 'config', 'user.name', 'Fixture');
	git(root, 'config', 'user.email', 'fixture@example.invalid');
	git(root, 'lfs', 'install', '--local');
	for (const [id, kind, path] of definitions) {
		await put(root, path, text);
		await put(
			root,
			`specification/units/${id}.json`,
			JSON.stringify({
				schemaVersion: 1,
				id,
				kind,
				title: id,
				responsibility: 'Fixture responsibility',
				responsibilityOrigin: 'declared',
				runtime: { kind: 'module', entry: path, targets: [{ kind: 'module', entry: path }] },
				scenarios: [],
				budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
				status: 'active',
				owns: { source: [path], symbols: [] },
				contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
				dependencies:
					id === 'page.home' ? [{ unit: 'function.filter', via: 'import', origin: 'declared' }] : []
			})
		);
	}
	await put(root, 'private.txt', 'PRIVATE_SOURCE_BODY');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'five canonical entities');
	const base = git(root, 'rev-parse', 'HEAD');
	git(root, 'checkout', '-b', 'feature/design');
	await put(root, 'src/components/Select.ts', 'feature branch source');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'feature source');
	const feature = git(root, 'rev-parse', 'HEAD');
	git(root, 'checkout', 'main');
	await put(root, 'src/functions/filter.ts', 'current function source');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'main source');
	const tip = git(root, 'rev-parse', 'HEAD');
	const session = new ProjectSessionService();
	await session.open(root);
	return { session, base, feature, tip, ...session.requireProject() };
}
