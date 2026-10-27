import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';
import type { Fixture, SandboxProcess } from './module-task-sandbox.test.types';

const childScript = `
const fs = require('node:fs');
const path = require('node:path');
const [snapshot, assigned, scratch, sibling, source, testFile, git, commonGit, app, outside, link, created, renamed, escape, scratchHardlink, targetCwd, rulesDirectory, rulesFile, siblingMdc, foreignRule] = process.argv.slice(-20);
const attempt = operation => { try { operation(); return true; } catch { return false; } };
let scratchHardlinkCreated = false;
const result = {
  snapshotRead: attempt(() => fs.readFileSync(snapshot, 'utf8')), assignedWrite: attempt(() => fs.writeFileSync(assigned, 'assigned')),
  scratchWrite: attempt(() => fs.writeFileSync(path.join(scratch, 'child.txt'), 'scratch')), siblingWrite: attempt(() => fs.writeFileSync(sibling, 'sibling')),
  foreignSourceRead: attempt(() => fs.readFileSync(source, 'utf8')), foreignTestRead: attempt(() => fs.readFileSync(testFile, 'utf8')),
  gitRead: attempt(() => fs.readFileSync(git, 'utf8')), commonGitRead: attempt(() => fs.readFileSync(commonGit, 'utf8')),
  appSourceRead: attempt(() => fs.readFileSync(app, 'utf8')), foreignModify: attempt(() => fs.writeFileSync(source, 'modified')),
  foreignCreate: attempt(() => fs.writeFileSync(created, 'created')), foreignDelete: attempt(() => fs.unlinkSync(testFile)),
  foreignRename: attempt(() => fs.renameSync(source, renamed)), symlinkEscape: attempt(() => fs.writeFileSync(link, 'escaped')),
  snapshotWrite: attempt(() => fs.writeFileSync(snapshot, 'tampered')), outsideWrite: attempt(() => fs.writeFileSync(outside, 'overwritten')),
  scratchHardlinkWrite: attempt(() => { fs.linkSync(outside, scratchHardlink); scratchHardlinkCreated = true; fs.writeFileSync(scratchHardlink, 'hardlink-modified'); }), sandboxedCwdMatches: process.cwd() === targetCwd,
  bunfigPreloadRan: globalThis.__harnessTaskBunfig === true, bunfigWriteBlocked: globalThis.__harnessTaskBunfigWriteBlocked === true,
  rulesDirectoryListed: attempt(() => { if (fs.readdirSync(rulesDirectory).sort().join(',') !== 'approved.rules,foreign.rules,sibling.mdc') throw new Error('Unexpected rules listing'); }),
  allowedRuleRead: attempt(() => { if (fs.readFileSync(rulesFile, 'utf8') !== 'approved synthetic policy\\n') throw new Error('Unexpected rules content'); }),
  siblingMdcRead: attempt(() => fs.readFileSync(siblingMdc, 'utf8')), foreignRuleRead: attempt(() => fs.readFileSync(foreignRule, 'utf8')),
  rulesDirectoryWrite: attempt(() => fs.writeFileSync(path.join(rulesDirectory, 'created.rules'), 'created')),
  allowedRuleWrite: attempt(() => fs.writeFileSync(rulesFile, 'tampered')),
  siblingMdcWrite: attempt(() => fs.writeFileSync(siblingMdc, 'tampered')),
  foreignRuleWrite: attempt(() => fs.writeFileSync(foreignRule, 'tampered'))
};
result.scratchHardlinkCreated = scratchHardlinkCreated;
for (const key of Object.keys(process.env)) delete process.env[key];
result.unsetEnvironmentWrite = attempt(() => fs.writeFileSync(created, 'after-unset'));
result.fileToDirectoryEscape = attempt(() => {
  fs.unlinkSync(assigned);
  fs.mkdirSync(assigned);
  fs.writeFileSync(escape, 'escaped');
});
process.stdout.write(JSON.stringify(result));
`;

export async function makeFixture(): Promise<Fixture> {
	const root = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'harness-task-sandbox-')));
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
		escape: join(cwd, 'src/[branch].ts/escape.ts'),
		rulesDirectory: join(root, 'codex-rules'),
		rulesFile: join(root, 'codex-rules/approved.rules'),
		siblingMdc: join(root, 'codex-rules/sibling.mdc'),
		foreignRule: join(root, 'codex-rules/foreign.rules')
	};
	await populateFixture({ root, cwd, scratch, snapshot, paths });
	return { root, cwd, scratch, snapshot, paths };
}

async function populateFixture(fixture: Fixture) {
	const { root, cwd, scratch, snapshot, paths } = fixture;
	await Promise.all(
		[
			join(cwd, 'src'),
			join(cwd, 'test'),
			join(cwd, '.git'),
			join(root, 'common.git'),
			scratch,
			paths.rulesDirectory
		].map((path) => fs.mkdir(path, { recursive: true }))
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
		fs.writeFile(paths.rulesFile, 'approved synthetic policy\n'),
		fs.writeFile(paths.siblingMdc, 'sibling metadata'),
		fs.writeFile(paths.foreignRule, 'foreign policy'),
		fs.mkdir(paths.directory)
	]);
}

export async function prepare(
	fixture: Fixture,
	files = ['src/[branch].ts'],
	exactReadDirectories: string[] = []
): Promise<SandboxProcess> {
	const p = fixture.paths;
	const bun = await fs.realpath(execFileSync('which', ['bun'], { encoding: 'utf8' }).trim());
	const targetCwd = await fs.realpath(fixture.cwd);
	const input = {
		cwd: fixture.cwd,
		files,
		snapshot: fixture.snapshot,
		scratch: fixture.scratch,
		readPaths: [bun, p.rulesFile],
		protectedPaths: [join(fixture.cwd, '.git'), join(fixture.root, 'common.git')],
		exactReadDirectories,
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
			targetCwd,
			p.rulesDirectory,
			p.rulesFile,
			p.siblingMdc,
			p.foreignRule
		]
	};
	return new ModuleTaskSandboxAdapter().prepare(input);
}

export function runChild(config: SandboxProcess) {
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

export const flagSet = (value: boolean, names: string): Record<string, boolean> =>
	Object.fromEntries(names.split(' ').map((name) => [name, value] as const));
export const unsafeGrantError = /unsafe|invalid|scope|file|grant|path/i;
