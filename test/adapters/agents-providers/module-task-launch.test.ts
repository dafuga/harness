import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';
import { ModuleTaskLaunchAdapter } from '../../../src/adapters/agents-providers/ModuleTaskLaunchAdapter';
import { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';
import { runChild } from './module-task-sandbox.test.fixtures';
import { measureWorkload } from '../../support/measureWorkload';

import type { SandboxRequest, SandboxProcess } from './module-task-launch.test.types';

async function seedProviderFiles(bin: string, rules: string, files: string[]) {
	const providerDirectory = join(bin, '..', 'provider');
	await Promise.all(
		[bin, rules, providerDirectory].map((directory) => fs.mkdir(directory, { recursive: true }))
	);
	const fakeCodex = join(bin, 'codex');
	const provider = join(providerDirectory, 'codex-real');
	await fs.writeFile(provider, '#!/bin/sh\nexit 0\n');
	await fs.chmod(provider, 0o755);
	await fs.symlink(provider, fakeCodex);
	await Promise.all(files.map((file) => fs.writeFile(file, 'synthetic placeholder')));
}
async function launchFixture(root: string) {
	const bin = join(root, 'bin'),
		codexHome = join(root, 'codex-home'),
		rules = join(codexHome, 'rules');
	const auth = join(codexHome, 'auth.json'),
		config = join(codexHome, 'config.toml');
	const approved = join(rules, 'approved.rules'),
		review = join(rules, 'review.rules');
	const ignored = join(rules, 'sibling.mdc'),
		foreign = join(rules, 'foreign.json');
	await seedProviderFiles(bin, rules, [auth, config, approved, review, ignored, foreign]);
	process.env.PATH = `${bin}:/usr/bin:/bin`;
	process.env.CODEX_HOME = codexHome;
	const cwd = join(root, 'worktree'),
		scratch = join(root, 'scratch'),
		snapshot = join(root, 'contracts.json');
	const assignedFile = join(cwd, 'src/assigned.ts'),
		inheritedRead = join(root, 'trusted-read');
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
	return {
		root,
		bin,
		codexHome,
		rules,
		reads: [auth, config, approved, review],
		ignored,
		foreign,
		input
	};
}

async function assertLaunchScope(
	prepared: SandboxRequest,
	argv: string[],
	f: Awaited<ReturnType<typeof launchFixture>>
) {
	const { root, codexHome, rules, reads, ignored, foreign, input } = f;
	const { scope } = input;
	const codexRoot = await fs.realpath(codexHome);
	const expectedReads = await Promise.all(reads.map((path) => fs.realpath(path)));
	expect(prepared.readPaths.filter((path) => path.startsWith(`${codexRoot}/`)).sort()).toEqual(
		expectedReads.sort()
	);
	expect(prepared.exactReadDirectories).toEqual([await fs.realpath(rules)]);
	expect(prepared.readPaths).not.toContain(await fs.realpath(ignored));
	expect(prepared.readPaths).not.toContain(await fs.realpath(foreign));
	expect(prepared.argv).toEqual([await fs.realpath(join(f.bin, 'codex')), ...argv.slice(1)]);
	expect(prepared).toMatchObject({
		files: scope.files,
		snapshot: scope.snapshot,
		scratch: scope.scratch,
		protectedPaths: scope.protectedPaths
	});
	expect(prepared.readPaths).toContain(join(root, 'trusted-read'));
	expect(scope).toEqual({
		files: ['src/assigned.ts'],
		snapshot: join(root, 'contracts.json'),
		scratch: join(root, 'scratch'),
		readPaths: [join(root, 'trusted-read')],
		protectedPaths: [join(input.cwd, '.git')]
	});
}

async function verifyCodexLaunch(f: Awaited<ReturnType<typeof launchFixture>>) {
	const { root, bin, codexHome, input } = f;
	const executeArgv: string[][] = [];
	const execute = vi.fn(async (argv: string[]) => {
		executeArgv.push(argv);
		return { code: 0, stdout: 'synthetic process result' };
	});
	const wrapper = {
		command: join(root, 'sandbox-launch'),
		args: ['--synthetic-wrapper'],
		cwd: input.cwd,
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
	await assertLaunchQualification(argv, input);
	if (process.platform === 'darwin') await assertNativeProviderLaunch(f, argv);
	const qualification = vi.fn(async () => {});
	const result = await new ModuleTaskLaunchAdapter({ qualification }).run(
		argv,
		input,
		execute,
		sandbox
	);
	expect(qualification).toHaveBeenCalledOnce();
	expect(qualification.mock.invocationCallOrder[0]).toBeLessThan(
		sandbox.prepare.mock.invocationCallOrder[0]
	);
	if (!prepared) throw new Error('Expected sandbox preparation');
	await assertLaunchScope(prepared, argv, f);
	expect(executeArgv).toEqual([[wrapper.command, ...wrapper.args]]);
	expect(result).toEqual({ code: 0, stdout: 'synthetic process result' });
	expect(wrapper.cleanup).toHaveBeenCalledOnce();
}

async function assertNativeProviderLaunch(
	f: Awaited<ReturnType<typeof launchFixture>>,
	argv: string[]
) {
	const link = join(f.bin, 'codex');
	const target = await fs.realpath(link);
	const execute = (command: string[], input: { cwd: string; env?: NodeJS.ProcessEnv }) =>
		runChild({
			command: command[0],
			args: command.slice(1),
			cwd: input.cwd,
			env: input.env ?? {},
			cleanup: async () => undefined
		});
	const launch = () =>
		new ModuleTaskLaunchAdapter({ qualification: async () => undefined }).run(
			argv,
			f.input,
			execute,
			new ModuleTaskSandboxAdapter()
		);
	await fs.unlink(link);
	await fs.copyFile(target, link);
	await fs.chmod(link, 0o755);
	const direct = await launch();
	expect(direct.code, 'synthetic direct provider should launch in the sandbox').toBe(0);
	await fs.unlink(link);
	await fs.symlink(target, link);
	const symlink = await launch();
	expect(symlink.code, 'synthetic symlink provider should launch in the sandbox').toBe(0);
}

test('Codex launch passes only synthetic rules grants with the assigned scope', async () =>
	measureWorkload(
		'adapter.agents-providers-module-task-launch',
		'synthetic-provider-launch',
		async () => {
			const root = await fs.mkdtemp(join(tmpdir(), 'harness-provider-launch-'));
			const previous = { PATH: process.env.PATH, CODEX_HOME: process.env.CODEX_HOME };
			try {
				await verifyCodexLaunch(await launchFixture(root));
			} finally {
				if (previous.PATH === undefined) delete process.env.PATH;
				else process.env.PATH = previous.PATH;
				if (previous.CODEX_HOME === undefined) delete process.env.CODEX_HOME;
				else process.env.CODEX_HOME = previous.CODEX_HOME;
				await fs.rm(root, { recursive: true, force: true });
			}
		}
	));

test('ModuleTaskLaunchAdapter connects', () => {
	expect(new ModuleTaskLaunchAdapter()).toBeInstanceOf(ModuleTaskLaunchAdapter);
});

async function assertLaunchQualification(
	argv: string[],
	input: Parameters<ModuleTaskLaunchAdapter['run']>[1]
) {
	const discovery = vi
		.spyOn(ModuleTaskProviderConfigAdapter.prototype, 'paths')
		.mockResolvedValue({ readPaths: [], exactReadDirectories: [] });
	const cleanup = vi.fn(async () => {});
	const sandbox = {
		prepare: vi.fn(async () => ({
			command: 'synthetic',
			args: [],
			cwd: input.cwd,
			env: {},
			cleanup
		}))
	};
	const execute = vi.fn(async () => ({ code: 0, stdout: 'synthetic' }));
	try {
		for (const mode of ['default', 'rejected', 'input-bypass'] as const) {
			const qualification = vi.fn(async () => {
				throw new Error('private qualification sentinel');
			});
			const adapter =
				mode === 'rejected'
					? new ModuleTaskLaunchAdapter({ qualification })
					: new ModuleTaskLaunchAdapter();
			const supplied =
				mode === 'input-bypass'
					? { ...input, qualified: true, qualification: async () => {}, allowUnqualified: true }
					: input;
			let failure: unknown;
			try {
				await adapter.run(argv, supplied, execute, sandbox);
			} catch (error) {
				failure = error;
			}
			expect(failure).toBeInstanceOf(Error);
			expect(failure).toMatchObject({
				quotaRejected: false,
				diagnostic: { category: 'permission', phase: 'prelaunch', nextAction: expect.any(String) }
			});
			expect(String(failure)).not.toContain('private qualification sentinel');
			expect(failure).not.toHaveProperty('usage');
			expect(discovery).not.toHaveBeenCalled();
			expect(sandbox.prepare).not.toHaveBeenCalled();
			expect(execute).not.toHaveBeenCalled();
			expect(cleanup).not.toHaveBeenCalled();
			if (mode === 'rejected') expect(qualification).toHaveBeenCalledOnce();
		}
	} finally {
		discovery.mockRestore();
	}
}
