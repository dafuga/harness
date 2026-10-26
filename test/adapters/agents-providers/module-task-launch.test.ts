import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';
import { ModuleTaskLaunchAdapter } from '../../../src/adapters/agents-providers/ModuleTaskLaunchAdapter';

import type { SandboxRequest, SandboxProcess } from './module-task-launch.test.types';

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
		await assertLaunchQualification(argv, input);
		const qualification = vi.fn(async () => {});
		const result = await new ModuleTaskLaunchAdapter({ qualification }).run(
			argv,
			input,
			execute,
			sandbox
		);
		expect(qualification).toHaveBeenCalledOnce();
		expect(qualification.mock.invocationCallOrder[0]).toBeLessThan(
			sandbox.prepare.mock.invocationCallOrder[0]!
		);
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
		expect(prepared.argv).toEqual(argv);
		expect(prepared).toMatchObject({
			files: scope.files,
			snapshot: scope.snapshot,
			scratch: scope.scratch,
			protectedPaths: scope.protectedPaths
		});
		expect(prepared.readPaths).toContain(inheritedRead);
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
