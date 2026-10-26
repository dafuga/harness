import { spawn } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';

type Fixture = Awaited<ReturnType<typeof makeFixture>>;
type SandboxProcess = Awaited<ReturnType<ModuleTaskSandboxAdapter['prepare']>>;

const childScript = `
const fs = require('node:fs');
const path = require('node:path');
const [snapshot, assigned, scratch, sibling, source, testFile, git, commonGit, app, outside, link, created, renamed, escape] = process.argv.slice(1);
const attempt = (operation) => { try { operation(); return true; } catch { return false; } };
const result = {
  snapshotRead: attempt(() => fs.readFileSync(snapshot, 'utf8')),
  assignedWrite: attempt(() => fs.writeFileSync(assigned, 'assigned')),
  scratchWrite: attempt(() => fs.writeFileSync(path.join(scratch, 'child.txt'), 'scratch')),
  siblingWrite: attempt(() => fs.writeFileSync(sibling, 'sibling')),
  foreignSourceRead: attempt(() => fs.readFileSync(source, 'utf8')),
  foreignTestRead: attempt(() => fs.readFileSync(testFile, 'utf8')),
  gitRead: attempt(() => fs.readFileSync(git, 'utf8')),
  commonGitRead: attempt(() => fs.readFileSync(commonGit, 'utf8')),
  appSourceRead: attempt(() => fs.readFileSync(app, 'utf8')),
  foreignModify: attempt(() => fs.writeFileSync(source, 'modified')),
  foreignCreate: attempt(() => fs.writeFileSync(created, 'created')),
  foreignDelete: attempt(() => fs.unlinkSync(testFile)),
  foreignRename: attempt(() => fs.renameSync(source, renamed)),
  symlinkEscape: attempt(() => fs.writeFileSync(link, 'escaped')),
  snapshotWrite: attempt(() => fs.writeFileSync(snapshot, 'tampered')),
  outsideWrite: attempt(() => fs.writeFileSync(outside, 'overwritten'))
};
for (const key of Object.keys(process.env)) delete process.env[key];
result.unsetEnvironmentWrite = attempt(() => fs.writeFileSync(created, 'after-unset'));
result.fileToDirectoryEscape = attempt(() => {
  fs.unlinkSync(assigned);
  fs.mkdirSync(assigned);
  fs.writeFileSync(escape, 'escaped');
});
process.stdout.write(JSON.stringify(result));
`;

async function makeFixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-task-sandbox-'));
	const cwd = join(root, 'project');
	const scratch = join(root, 'scratch');
	const snapshot = join(root, 'contracts.json');
	const paths = {
		assigned: join(cwd, 'src/[branch].ts'),
		sibling: join(cwd, 'src/b.ts'),
		source: join(cwd, 'src/foreign.ts'),
		test: join(cwd, 'test/foreign.test.ts'),
		git: join(cwd, '.git/config'),
		commonGit: join(root, 'common.git/config'),
		app: join(root, 'app-source.ts'),
		outside: join(root, 'outside-sentinel.txt'),
		link: join(cwd, 'src/escape-link.ts'),
		hardlink: join(cwd, 'src/hardlink.ts'),
		directory: join(cwd, 'src/directory.ts'),
		created: join(cwd, 'foreign-create.ts'),
		renamed: join(cwd, 'renamed.ts'),
		escape: join(cwd, 'src/[branch].ts/escape.ts')
	};
	await Promise.all(
		[join(cwd, 'src'), join(cwd, 'test'), join(cwd, '.git'), join(root, 'common.git'), scratch].map(
			(path) => mkdir(path, { recursive: true })
		)
	);
	await Promise.all([
		writeFile(paths.assigned, 'before'),
		writeFile(paths.sibling, 'sibling'),
		writeFile(paths.source, 'foreign-source'),
		writeFile(paths.test, 'foreign-test'),
		writeFile(paths.git, 'repository-git'),
		writeFile(paths.commonGit, 'common-git'),
		writeFile(paths.app, 'outside-app-source'),
		writeFile(paths.outside, 'outside-original'),
		writeFile(snapshot, '{"contract":"read-only"}'),
		mkdir(paths.directory)
	]);
	return { root, cwd, scratch, snapshot, paths };
}

function prepare(fixture: Fixture, files = ['src/[branch].ts']): Promise<SandboxProcess> {
	const p = fixture.paths;
	return new ModuleTaskSandboxAdapter().prepare({
		cwd: fixture.cwd,
		files,
		snapshot: fixture.snapshot,
		scratch: fixture.scratch,
		readPaths: [process.execPath],
		protectedPaths: [join(fixture.cwd, '.git'), join(fixture.root, 'common.git')],
		argv: [
			process.execPath,
			'-e',
			childScript,
			fixture.snapshot,
			p.assigned,
			fixture.scratch,
			p.sibling,
			p.source,
			p.test,
			p.git,
			p.commonGit,
			p.app,
			p.outside,
			p.link,
			p.created,
			p.renamed,
			p.escape
		]
	});
}

function runChild(
	config: SandboxProcess
): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(config.command, config.args, {
			cwd: config.cwd,
			env: config.env,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		const timeout = setTimeout(() => child.kill('SIGKILL'), 20_000);
		child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
		child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
		child.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once('close', (code) => {
			clearTimeout(timeout);
			resolve({ code: code ?? -1, stdout, stderr });
		});
	});
}

test.skipIf(process.platform !== 'darwin')(
	'enforces exact reads and writes in a real child',
	async () => {
		const fixture = await makeFixture();
		let config: SandboxProcess | undefined;
		try {
			await symlink(fixture.paths.outside, fixture.paths.link);
			config = await prepare(fixture);
			expect(config.cwd).toBe(fixture.cwd);
			const child = await runChild(config);
			expect(child.code, child.stderr).toBe(0);
			const checks = JSON.parse(child.stdout) as Record<string, boolean>;
			expect(checks).toMatchObject({
				snapshotRead: true,
				assignedWrite: true,
				scratchWrite: true,
				siblingWrite: false,
				foreignSourceRead: false,
				foreignTestRead: false,
				gitRead: false,
				commonGitRead: false,
				appSourceRead: false,
				foreignModify: false,
				foreignCreate: false,
				foreignDelete: false,
				foreignRename: false,
				symlinkEscape: false,
				snapshotWrite: false,
				outsideWrite: false,
				unsetEnvironmentWrite: false,
				fileToDirectoryEscape: false
			});
			expect(await readFile(join(fixture.scratch, 'child.txt'), 'utf8')).toBe('scratch');
			expect(await readFile(fixture.snapshot, 'utf8')).toBe('{"contract":"read-only"}');
			expect(await readFile(fixture.paths.outside, 'utf8')).toBe('outside-original');
			expect(await readFile(fixture.paths.source, 'utf8')).toBe('foreign-source');
			expect(await readFile(fixture.paths.test, 'utf8')).toBe('foreign-test');
			expect(await readFile(fixture.paths.link, 'utf8')).toBe('outside-original');
			await expect(readFile(fixture.paths.escape)).rejects.toThrow();
		} finally {
			await config?.cleanup();
			await rm(fixture.root, { recursive: true, force: true });
		}
	}
);
test.skipIf(process.platform !== 'darwin')(
	'rejects unsafe grant paths before returning a process',
	async () => {
		const fixture = await makeFixture();
		try {
			await symlink(fixture.paths.outside, fixture.paths.link);
			await link(fixture.paths.outside, fixture.paths.hardlink);
			for (const files of [
				['../outside-sentinel.txt'],
				[fixture.paths.assigned],
				['src/escape-link.ts'],
				['src/hardlink.ts'],
				['src/directory.ts']
			]) {
				await expect(prepare(fixture, files)).rejects.toThrow(
					/unsafe|invalid|scope|file|grant|path/i
				);
			}
		} finally {
			await rm(fixture.root, { recursive: true, force: true });
		}
	}
);
test.skipIf(process.platform === 'darwin')('fails closed with a platform diagnostic', async () => {
	const fixture = await makeFixture();
	try {
		await expect(prepare(fixture)).rejects.toThrow(/sandbox|unsupported|unavailable|SRT/i);
	} finally {
		await rm(fixture.root, { recursive: true, force: true });
	}
});
test('ModuleTaskSandboxAdapter connects', () => {
	expect(new ModuleTaskSandboxAdapter()).toBeInstanceOf(ModuleTaskSandboxAdapter);
});
