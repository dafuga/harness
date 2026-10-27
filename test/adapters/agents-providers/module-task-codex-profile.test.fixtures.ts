import { expect } from 'vitest';
import {
	chmod,
	copyFile,
	link,
	mkdir,
	mkdtemp,
	realpath,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ModuleTaskCodexProfileAdapter } from '../../../src/adapters/agents-providers/ModuleTaskCodexProfileAdapter';

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

export async function profileFixture() {
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
		name: 'custom',
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

export async function defaultProfileFixture() {
	const fixture = await profileFixture();
	const executable = join(
		fixture.root,
		'.codex/packages/standalone/releases/0.154.0-aarch64-apple-darwin/bin/codex'
	);
	await mkdir(dirname(executable), { recursive: true });
	await copyFile(fixture.executable, executable);
	await chmod(executable, 0o755);
	return { ...fixture, pinnedExecutable: executable };
}

async function configureScope(f: Awaited<ReturnType<typeof profileFixture>>, kind: string) {
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
	if (kind === 'non-codex') f.input.argv[0] = 'sh';
	if (kind === 'scratch-link') await symlink(f.credential, join(f.input.scratch, 'escape'));
}

async function configureReadAlias(f: Awaited<ReturnType<typeof profileFixture>>, kind: string) {
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
}

export async function assertUnsafeProfiles() {
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
			await configureScope(f, kind);
			await configureReadAlias(f, kind);
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
