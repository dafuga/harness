import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';
import type { Fixture, SandboxProcess } from './module-task-sandbox.test.types';

const childScript = `
const fs = require('node:fs');
const path = require('node:path');
const [snapshot, assigned, scratch, sibling, source, testFile, git, commonGit, app, outside, link, created, renamed, escape, scratchHardlink, targetCwd] = process.argv.slice(-16);
const attempt = operation => { try { operation(); return true; } catch { return false; } };
const result = {
  snapshotRead: attempt(() => fs.readFileSync(snapshot, 'utf8')), assignedWrite: attempt(() => fs.writeFileSync(assigned, 'assigned')),
  scratchWrite: attempt(() => fs.writeFileSync(path.join(scratch, 'child.txt'), 'scratch')), siblingWrite: attempt(() => fs.writeFileSync(sibling, 'sibling')),
  foreignSourceRead: attempt(() => fs.readFileSync(source, 'utf8')), foreignTestRead: attempt(() => fs.readFileSync(testFile, 'utf8')),
  gitRead: attempt(() => fs.readFileSync(git, 'utf8')), commonGitRead: attempt(() => fs.readFileSync(commonGit, 'utf8')),
  appSourceRead: attempt(() => fs.readFileSync(app, 'utf8')), foreignModify: attempt(() => fs.writeFileSync(source, 'modified')),
  foreignCreate: attempt(() => fs.writeFileSync(created, 'created')), foreignDelete: attempt(() => fs.unlinkSync(testFile)),
  foreignRename: attempt(() => fs.renameSync(source, renamed)), symlinkEscape: attempt(() => fs.writeFileSync(link, 'escaped')),
  snapshotWrite: attempt(() => fs.writeFileSync(snapshot, 'tampered')), outsideWrite: attempt(() => fs.writeFileSync(outside, 'overwritten')),
  scratchHardlinkWrite: attempt(() => fs.writeFileSync(scratchHardlink, 'hardlink-modified')), sandboxedCwdMatches: process.cwd() === targetCwd,
  bunfigPreloadRan: globalThis.__harnessTaskBunfig === true, bunfigWriteBlocked: globalThis.__harnessTaskBunfigWriteBlocked === true
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
const flagSet = (value: boolean, names: string): Record<string, boolean> =>
	Object.fromEntries(names.split(' ').map((name) => [name, value] as const));

async function makeFixture(): Promise<Fixture> {
	const root = await fs.mkdtemp(join(tmpdir(), 'harness-task-sandbox-'));
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
		bunfig: join(cwd, 'bunfig.toml'),
		preload: join(cwd, 'bunfig-preload.js'),
		scratchHardlink: join(scratch, 'foreign-hardlink.txt'),
		link: join(cwd, 'src/escape-link.ts'),
		hardlink: join(cwd, 'src/hardlink.ts'),
		directory: join(cwd, 'src/directory.ts'),
		created: join(cwd, 'foreign-create.ts'),
		renamed: join(cwd, 'renamed.ts'),
		escape: join(cwd, 'src/[branch].ts/escape.ts')
	};
	await Promise.all(
		[join(cwd, 'src'), join(cwd, 'test'), join(cwd, '.git'), join(root, 'common.git'), scratch].map(
			(path) => fs.mkdir(path, { recursive: true })
		)
	);
	await Promise.all([
		fs.writeFile(paths.assigned, 'before'),
		fs.writeFile(paths.sibling, 'sibling'),
		fs.writeFile(paths.source, 'foreign-source'),
		fs.writeFile(paths.test, 'foreign-test'),
		fs.writeFile(paths.git, 'repository-git'),
		fs.writeFile(paths.commonGit, 'common-git'),
		fs.writeFile(paths.app, 'outside-app-source'),
		fs.writeFile(paths.outside, 'outside-original'),
		fs.writeFile(paths.bunfig, 'preload = ["./bunfig-preload.js"]\n'),
		fs.writeFile(
			paths.preload,
			`globalThis.__harnessTaskBunfig = true; try { require('node:fs').writeFileSync(${JSON.stringify(paths.outside)}, 'preload'); } catch { globalThis.__harnessTaskBunfigWriteBlocked = true; }`
		),
		fs.writeFile(snapshot, '{"contract":"read-only"}'),
		fs.mkdir(paths.directory)
	]);
	return { root, cwd, scratch, snapshot, paths };
}

async function prepare(fixture: Fixture, files = ['src/[branch].ts']): Promise<SandboxProcess> {
	const p = fixture.paths;
	const bun = await fs.realpath(execFileSync('which', ['bun'], { encoding: 'utf8' }).trim());
	const targetCwd = await fs.realpath(fixture.cwd);
	return new ModuleTaskSandboxAdapter().prepare({
		cwd: fixture.cwd,
		files,
		snapshot: fixture.snapshot,
		scratch: fixture.scratch,
		readPaths: [bun, p.bunfig, p.preload],
		protectedPaths: [join(fixture.cwd, '.git'), join(fixture.root, 'common.git')],
		argv: [
			bun,
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
			p.escape,
			p.scratchHardlink,
			targetCwd
		]
	});
}

function runChild(config: SandboxProcess) {
	return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
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

const nativeTest = test.skipIf(process.platform !== 'darwin');
nativeTest('enforces exact reads and writes in a real child', async () => {
	const fixture = await makeFixture();
	let config: SandboxProcess | undefined;
	try {
		await fs.symlink(fixture.paths.outside, fixture.paths.link);
		await fs.link(fixture.paths.outside, fixture.paths.scratchHardlink);
		config = await prepare(fixture);
		const hostCwd = await fs.realpath(config.cwd);
		expect(hostCwd).not.toBe(await fs.realpath(fixture.cwd));
		expect(relative(fixture.cwd, hostCwd)).toMatch(/^\.\.(?:\/|$)/);
		expect((await fs.stat(hostCwd)).mode & 0o077).toBe(0);
		const child = await runChild(config);
		expect(child.code, child.stderr).toBe(0);
		const checks = JSON.parse(child.stdout) as Record<string, boolean>;
		expect(checks).toMatchObject({
			...flagSet(
				true,
				'snapshotRead assignedWrite scratchWrite sandboxedCwdMatches bunfigPreloadRan bunfigWriteBlocked'
			),
			...flagSet(
				false,
				'siblingWrite foreignSourceRead foreignTestRead gitRead commonGitRead appSourceRead foreignModify foreignCreate foreignDelete foreignRename symlinkEscape snapshotWrite outsideWrite scratchHardlinkWrite unsetEnvironmentWrite fileToDirectoryEscape'
			)
		});
		expect(await fs.readFile(join(fixture.scratch, 'child.txt'), 'utf8')).toBe('scratch');
		expect(await fs.readFile(fixture.snapshot, 'utf8')).toBe('{"contract":"read-only"}');
		expect(await fs.readFile(fixture.paths.outside, 'utf8')).toBe('outside-original');
		expect(await fs.readFile(fixture.paths.scratchHardlink, 'utf8')).toBe('outside-original');
		expect(await fs.readFile(fixture.paths.source, 'utf8')).toBe('foreign-source');
		expect(await fs.readFile(fixture.paths.test, 'utf8')).toBe('foreign-test');
		expect(await fs.readFile(fixture.paths.link, 'utf8')).toBe('outside-original');
		await expect(fs.readFile(fixture.paths.escape)).rejects.toThrow();
	} finally {
		await config?.cleanup();
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});
nativeTest('rejects unsafe grant paths before returning a process', async () => {
	const fixture = await makeFixture();
	try {
		await fs.symlink(fixture.paths.outside, fixture.paths.link);
		await fs.link(fixture.paths.outside, fixture.paths.hardlink);
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
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});
test.skipIf(process.platform === 'darwin')('fails closed with a platform diagnostic', async () => {
	const fixture = await makeFixture();
	try {
		await expect(prepare(fixture)).rejects.toThrow(/sandbox|unsupported|unavailable|SRT/i);
	} finally {
		await fs.rm(fixture.root, { recursive: true, force: true });
	}
});
test('ModuleTaskSandboxAdapter connects', () => {
	expect(new ModuleTaskSandboxAdapter()).toBeInstanceOf(ModuleTaskSandboxAdapter);
});
