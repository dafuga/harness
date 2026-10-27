import { expect, test, vi } from 'vitest';
import { chmod, link, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleTaskCodexProfileAdapter } from '../../../src/adapters/agents-providers/ModuleTaskCodexProfileAdapter';

test('ModuleTaskCodexProfileAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-codex-profile'
	expect(new ModuleTaskCodexProfileAdapter().connect()).toBe('module-task-codex-profile');
});

test('ModuleTaskCodexProfileAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskCodexProfileAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskCodexProfileAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskCodexProfileAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});

async function profileFiles() {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'codex-profile-test-')));
	const cwd = join(root, 'workspace'),
		scratch = join(root, 'scratch');
	const runtime = join(root, 'runtime'),
		binDirectory = join(root, 'sealed-cli');
	const credential = join(root, 'private', 'auth.json'),
		snapshot = join(root, 'snapshot.json');
	for (const directory of [
		join(cwd, 'src'),
		scratch,
		runtime,
		binDirectory,
		join(root, 'private')
	]) {
		await mkdir(directory, { recursive: true });
	}
	const executable = join(runtime, 'codex');
	for (const [path, content] of [
		[join(cwd, 'src/assigned.ts'), 'export const assigned = true;'],
		[join(cwd, 'src/unassigned.ts'), 'synthetic unassigned source'],
		[credential, 'synthetic credential sentinel'],
		[snapshot, '{}'],
		[executable, '#!/bin/sh\nexit 99\n'],
		[join(binDirectory, 'harness'), '#!/bin/sh\nexit 99\n']
	])
		await writeFile(path, content);
	await chmod(executable, 0o755);
	return { root, cwd, scratch, runtime, binDirectory, credential, snapshot, executable };
}

async function profileFixture() {
	const { root, cwd, scratch, runtime, binDirectory, credential, snapshot, executable } =
		await profileFiles();
	const input = {
		cwd,
		scratch,
		snapshot,
		binDirectory,
		files: ['src/assigned.ts'],
		readPaths: [runtime, binDirectory],
		protectedPaths: [credential],
		argv: [
			'codex',
			'exec',
			'--model',
			'gpt-6-luna',
			'-c',
			'model_reasoning_effort="max"',
			'--json',
			'prompt'
		]
	};
	const adapter = new ModuleTaskCodexProfileAdapter({
		resolveExecutable: async () => executable,
		platform: 'darwin'
	});
	return {
		root,
		executable,
		credential,
		input,
		adapter,
		dispose: () => rm(root, { recursive: true, force: true })
	};
}

function configOverrides(args: string[]) {
	return args.flatMap((arg, index) =>
		arg === '-c' || arg === '--config' ? [args[index + 1]] : []
	);
}

function assertNativeArgs(args: string[]) {
	for (const flag of ['--ignore-user-config', '--strict-config', '--ephemeral'])
		expect(args).toContain(flag);
	for (const flag of [
		'--sandbox',
		'-s',
		'--ignore-rules',
		'--dangerously-bypass-approvals-and-sandbox',
		'--full-auto'
	])
		expect(args).not.toContain(flag);
	expect(args[args.indexOf('--model') + 1]).toBe('gpt-6-luna');
	expect(configOverrides(args)).toContain('model_reasoning_effort="max"');
	const config = configOverrides(args).join('\n');
	for (const [setting, value] of [
		['approval_policy', 'never'],
		['web_search', 'disabled'],
		['inherit', 'none']
	])
		expect(config).toMatch(new RegExp(setting + '\\s*=\\s*["\']' + value + '["\']'));
	for (const setting of ['apps', 'plugins', 'multi_agent', 'experimental_use_profile'])
		expect(config).toMatch(new RegExp(setting + '\\s*=\\s*false'));
	expect(config).toMatch(/network[^\n]*enabled\s*=\s*false/);
}

function assertExactGrants(config: string, f: Awaited<ReturnType<typeof profileFixture>>) {
	const grants = new Map(
		[...config.matchAll(/(["'])(.*?)\1\s*=\s*(["'])(read|write|deny)\3/g)].map((match) => [
			match[2],
			match[4]
		])
	);
	expect(grants.get(':root')).toBe('deny');
	expect(grants.get(join(f.input.cwd, 'src/assigned.ts'))).toBe('write');
	expect(grants.get(f.input.scratch)).toBe('write');
	for (const path of [f.input.snapshot, ...f.input.readPaths])
		expect(grants.get(path)).toBe('read');
	for (const path of [
		f.input.cwd,
		join(f.input.cwd, 'src'),
		join(f.input.cwd, 'src/unassigned.ts'),
		f.credential
	])
		expect(['read', 'write']).not.toContain(grants.get(path));
	expect(
		[...grants]
			.filter(([, access]) => access === 'write')
			.map(([path]) => path)
			.sort()
	).toEqual([join(f.input.cwd, 'src/assigned.ts'), f.input.scratch].sort());
}

async function assertNativeProfile() {
	const f = await profileFixture();
	vi.stubEnv('OPENAI_API_KEY', 'synthetic-openai-secret');
	vi.stubEnv('GITHUB_TOKEN', 'synthetic-github-secret');
	vi.stubEnv('CODEX_HOME', join(f.root, 'private'));
	let prepared: Awaited<ReturnType<typeof f.adapter.prepare>> | undefined;
	try {
		const before = structuredClone(f.input);
		prepared = await f.adapter.prepare(f.input);
		expect(prepared.command).toBe(f.executable);
		assertNativeArgs(prepared.args);
		assertExactGrants(configOverrides(prepared.args).join('\n'), f);
		expect(JSON.stringify(prepared.env)).not.toMatch(
			/synthetic-openai-secret|synthetic-github-secret/
		);
		expect(prepared.env.OPENAI_API_KEY).toBeUndefined();
		expect(prepared.env.GITHUB_TOKEN).toBeUndefined();
		expect(f.input).toEqual(before);
	} finally {
		await prepared?.cleanup();
		vi.unstubAllEnvs();
		await f.dispose();
	}
}

async function assertUnsafeProfiles() {
	const accepted: string[] = [];
	for (const kind of [
		'missing',
		'parent',
		'symlink',
		'hardlink',
		'runtime-credential',
		'runtime-source',
		'runtime-hardlink',
		'runtime-symlink',
		'read-parent-symlink',
		'sealed-cli-hardlink',
		'snapshot-hardlink',
		'non-codex',
		'scratch-link'
	]) {
		const f = await profileFixture();
		try {
			if (kind === 'missing') f.input.files = ['src/missing.ts'];
			if (kind === 'parent') f.input.files = ['../private/auth.json'];
			if (['symlink', 'hardlink'].includes(kind)) {
				const alias = join(f.input.cwd, 'src/alias.ts');
				if (kind === 'symlink') await symlink(f.credential, alias);
				else await link(f.credential, alias);
				f.input.files = ['src/alias.ts'];
			}
			if (kind === 'runtime-credential') f.input.readPaths.push(f.credential);
			if (kind === 'runtime-source') f.input.readPaths.push(f.input.cwd);
			if (kind === 'runtime-hardlink')
				await link(f.credential, join(f.input.readPaths[0], 'alias.txt'));
			if (kind === 'runtime-symlink')
				await symlink(f.credential, join(f.input.readPaths[0], 'alias.txt'));
			if (kind === 'read-parent-symlink') {
				await mkdir(join(f.input.readPaths[0], 'nested'));
				const alias = join(f.root, 'runtime-alias');
				await symlink(f.input.readPaths[0], alias);
				f.input.readPaths.push(join(alias, 'nested'));
			}
			if (kind === 'sealed-cli-hardlink')
				await link(f.credential, join(f.input.binDirectory, 'alias.txt'));
			if (kind === 'snapshot-hardlink') {
				f.input.snapshot = join(f.root, 'snapshot-alias.json');
				await link(f.credential, f.input.snapshot);
			}
			if (kind === 'non-codex') f.input.argv[0] = 'sh';
			if (kind === 'scratch-link') await symlink(f.credential, join(f.input.scratch, 'escape'));
			let prepared: Awaited<ReturnType<typeof f.adapter.prepare>> | undefined;
			try {
				prepared = await f.adapter.prepare(f.input);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
			if (prepared) {
				accepted.push(kind);
				await prepared.cleanup();
			}
		} finally {
			await f.dispose();
		}
	}
	expect(accepted).toEqual([]);
}

test('ModuleTaskCodexProfileAdapter.prepare admits exact native permissions and rejects unsafe scopes', async () => {
	await assertNativeProfile();
	await assertUnsafeProfiles();
});
