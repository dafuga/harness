import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ModuleTaskSandboxInput } from './ModuleTaskSandboxAdapter.types';
import type { ModuleTaskSandboxProcessAdapterConfig } from './ModuleTaskSandboxProcessAdapter.types';

export class ModuleTaskSandboxProcessAdapter {
	constructor(private readonly config: ModuleTaskSandboxProcessAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-sandbox-process';
	}

	command(sdk: string, settings: string, argv: string[]): string[] {
		return [process.execPath, '-e', sandboxDriver, sdk, settings, JSON.stringify(argv)];
	}

	async validateScratch(path: string): Promise<void> {
		const pending = [path];
		let visited = 0;
		while (pending.length) {
			const current = pending.pop()!;
			const stat = await lstat(current);
			if (
				++visited > 4096 ||
				stat.isSymbolicLink() ||
				(!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1))
			) {
				throw new Error('Unsafe sandbox scratch contents or file alias.');
			}
			if (stat.isDirectory()) {
				for (const entry of await readdir(current)) pending.push(join(current, entry));
			}
		}
	}

	arguments(scope: ModuleTaskSandboxInput): string[] {
		return ['/usr/bin/env'].concat(
			['TMPDIR', 'TMP', 'TEMP', 'CLAUDE_CODE_TMPDIR', 'CLAUDE_TMPDIR'].map(
				(key) => `${key}=${scope.scratch}`
			),
			['/bin/sh', '-c', 'cd -P -- "$1" || exit; shift; exec "$@"', 'harness-task', scope.cwd],
			scope.argv
		);
	}

	environment(
		scope: ModuleTaskSandboxInput,
		directory: string
	): Record<string, string | undefined> {
		const names = 'HOME USER PATH LANG LC_ALL TERM SHELL CODEX_HOME CLAUDE_CONFIG_DIR'.split(' ');
		return {
			...Object.fromEntries(
				names
					.filter((name) => process.env[name] !== undefined)
					.map((name) => [name, process.env[name]])
			),
			PATH: scope.binDirectory
				? `${scope.binDirectory}:${process.env.PATH ?? '/usr/bin:/bin'}`
				: process.env.PATH,
			TMPDIR: directory,
			TMP: directory,
			TEMP: directory,
			HARNESS_TASK_CONTRACT_SNAPSHOT: scope.snapshot
		};
	}
}

/** This driver gets its own SDK state and starts outside every task-owned directory. */
const sandboxDriver = String.raw`
(async () => {
  const {readFile} = require('node:fs/promises');
  const {spawn} = require('node:child_process');
  const {pathToFileURL} = require('node:url');
  const [sdk, settings, encoded] = process.argv.slice(1);
  const {SandboxManager} = await import(pathToFileURL(sdk).href);
  let initialized = false;
  try {
    await SandboxManager.initialize(JSON.parse(await readFile(settings, 'utf8')), undefined, false);
    initialized = true;
    const quote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'";
    const command = JSON.parse(encoded).map(quote).join(' ');
    const wrapped = await SandboxManager.wrapWithSandbox(command, '/bin/sh');
    const marker = '/usr/bin/sandbox-exec -p ';
    const offset = wrapped.indexOf(marker);
    if (offset < 0) throw new Error('Unsupported native wrapper.');
    const start = offset + marker.length;
    let end = start, state = '';
    for (; end < wrapped.length; end++) {
      const char = wrapped[end];
      if (state) { if (char === state) state = ''; }
      else if (char === "'" || char === '"') state = char;
      else if (/\s/.test(char)) break;
    }
    const token = wrapped.slice(start, end);
    const profile = token.slice(1, -1).replace(/'"'"'/g, "'");
    if (state || quote(profile) !== token || !profile.startsWith('(version 1)')) {
      throw new Error('Unsupported native profile.');
    }
    const secured = wrapped.slice(0, start) + quote(profile + '\n(deny file-link)') + wrapped.slice(end);
    const child = spawn('/bin/sh', ['-c', secured], {stdio: 'inherit'});
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => resolve(code === null ? 1 : code));
    });
    process.exitCode = code;
  } catch {
    process.stderr.write('Harness native task isolation unavailable.\n');
    process.exitCode = 1;
  } finally {
    if (initialized) await SandboxManager.reset();
  }
})().catch(() => {
  process.stderr.write('Harness native task isolation unavailable.\n');
  process.exitCode = 1;
});
`;

export type { ModuleTaskSandboxProcessAdapterConfig } from './ModuleTaskSandboxProcessAdapter.types';
