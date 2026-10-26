import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ModuleTaskLaunchAdapter } from '../../../src/adapters/agents-providers/ModuleTaskLaunchAdapter';

type SandboxRequest = {
	cwd: string;
	argv: string[];
	files: string[];
	snapshot: string;
	scratch: string;
	readPaths: string[];
	protectedPaths: string[];
	exactReadDirectories?: string[];
};
type SandboxProcess = {
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	cleanup(): Promise<void>;
};

test('Codex launch passes only synthetic rules grants with the assigned scope', async () => {
	const root = await fs.mkdtemp(join(tmpdir(), 'harness-provider-launch-'));
	const previous = { PATH: process.env.PATH, CODEX_HOME: process.env.CODEX_HOME };
	try {
		const bin = join(root, 'bin');
		const codexHome = join(root, 'codex-home');
		const rules = join(codexHome, 'rules');
		const fakeCodex = join(bin, 'codex');
		const auth = join(codexHome, 'auth.json');
		const config = join(codexHome, 'config.toml');
		const approved = join(rules, 'approved.rules');
		const review = join(rules, 'review.rules');
		const ignored = join(rules, 'sibling.mdc');
		const foreign = join(rules, 'foreign.json');
		await Promise.all([bin, rules].map((directory) => fs.mkdir(directory, { recursive: true })));
		await fs.writeFile(fakeCodex, '#!/bin/sh\nexit 0\n');
		await fs.chmod(fakeCodex, 0o755);
		await Promise.all(
			[auth, config, approved, review, ignored, foreign].map((file) =>
				fs.writeFile(file, 'synthetic placeholder')
			)
		);
		process.env.PATH = bin;
		process.env.CODEX_HOME = codexHome;
		const cwd = join(root, 'worktree');
		const scratch = join(root, 'scratch');
		const snapshot = join(root, 'contracts.json');
		const assignedFile = join(cwd, 'src/assigned.ts');
		const inheritedRead = join(root, 'trusted-read');
		const protectedPath = join(cwd, '.git');
		await Promise.all(
			[join(cwd, 'src'), protectedPath, scratch].map((path) => fs.mkdir(path, { recursive: true }))
		);
		await Promise.all(
			[assignedFile, snapshot, inheritedRead].map((path) => fs.writeFile(path, 'synthetic'))
		);
		const scope = {
			files: ['src/assigned.ts'],
			snapshot,
			scratch,
			readPaths: [inheritedRead],
			protectedPaths: [protectedPath]
		};
		const input = {
			provider: 'codex' as const,
			model: 'gpt-6-luna',
			intelligence: 'max',
			cwd,
			prompt: 'synthetic provider launch',
			signal: new AbortController().signal,
			scope
		};
		const executeArgv: string[][] = [];
		const execute = vi.fn(async (argv: string[]) => {
			executeArgv.push(argv);
			return { code: 0, stdout: 'synthetic process result' };
		});
		const wrapper = {
			command: join(root, 'sandbox-launch'),
			args: ['--synthetic-wrapper'],
			cwd,
			env: { PATH: bin, CODEX_HOME: codexHome },
			cleanup: vi.fn(async () => undefined)
		};
		let prepared: SandboxRequest | undefined;
		const sandbox = {
			prepare: vi.fn(async (request: SandboxRequest): Promise<SandboxProcess> => {
				prepared = request;
				return wrapper;
			})
		};
		const argv = ['codex', 'exec', '--model', 'gpt-6-luna'];
		const result = await new ModuleTaskLaunchAdapter().run(argv, input, execute, sandbox);
		if (!prepared) throw new Error('Expected sandbox preparation');
		const codexRoot = await fs.realpath(codexHome);
		const expectedReads = await Promise.all(
			[auth, config, approved, review].map((path) => fs.realpath(path))
		);
		expect(prepared.readPaths.filter((path) => path.startsWith(`${codexRoot}/`)).sort()).toEqual(
			expectedReads.sort()
		);
		expect(prepared.exactReadDirectories).toEqual([await fs.realpath(rules)]);
		expect(prepared.readPaths).not.toContain(await fs.realpath(ignored));
		expect(prepared.readPaths).not.toContain(await fs.realpath(foreign));
		expect(prepared.argv).toEqual([await fs.realpath(fakeCodex), ...argv.slice(1)]);
		expect(prepared).toMatchObject({
			files: scope.files,
			snapshot: scope.snapshot,
			scratch: scope.scratch,
			protectedPaths: scope.protectedPaths
		});
		expect(prepared.readPaths).toContain(await fs.realpath(inheritedRead));
		expect(scope).toEqual({
			files: ['src/assigned.ts'],
			snapshot,
			scratch,
			readPaths: [inheritedRead],
			protectedPaths: [protectedPath]
		});
		expect(executeArgv).toEqual([[wrapper.command, ...wrapper.args]]);
		expect(result).toEqual({ code: 0, stdout: 'synthetic process result' });
		expect(wrapper.cleanup).toHaveBeenCalledOnce();
	} finally {
		if (previous.PATH === undefined) delete process.env.PATH;
		else process.env.PATH = previous.PATH;
		if (previous.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
		else process.env.CODEX_HOME = previous.CODEX_HOME;
		await fs.rm(root, { recursive: true, force: true });
	}
});

test('ModuleTaskLaunchAdapter connects', () => {
	expect(new ModuleTaskLaunchAdapter()).toBeInstanceOf(ModuleTaskLaunchAdapter);
});
