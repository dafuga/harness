import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';

import type {
	ProviderConfigOptions,
	ProviderConfigApi
} from './module-task-provider-config.test.types';

const ProviderConfig = ModuleTaskProviderConfigAdapter as unknown as new (
	options: ProviderConfigOptions
) => ProviderConfigApi;

async function withRoot(check: (root: string) => Promise<void>) {
	const root = await fs.mkdtemp(join(tmpdir(), 'harness-provider-config-'));
	try {
		await check(root);
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

async function createFiles(files: string[]) {
	for (const file of files) {
		await fs.mkdir(dirname(file), { recursive: true });
		await fs.writeFile(file, 'synthetic placeholder; never read by this test');
	}
}

async function realPaths(paths: string[]) {
	return Promise.all(paths.map((path) => fs.realpath(path)));
}

test('ModuleTaskProviderConfigAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-provider-config'
	expect(new ModuleTaskProviderConfigAdapter().connect()).toBe('module-task-provider-config');
});

test('ModuleTaskProviderConfigAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskProviderConfigAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskProviderConfigAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskProviderConfigAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});

test('Codex paths include only existing auth, config and regular rules files', async () =>
	withRoot(async (home) => {
		const codexHome = join(home, '.codex');
		const rules = join(codexHome, 'rules');
		const files = [
			join(codexHome, 'auth.json'),
			join(codexHome, 'config.toml'),
			join(rules, 'approved.rules'),
			join(rules, 'review.rules')
		];
		await createFiles([...files, join(rules, 'unrelated.mdc'), join(rules, 'foreign.txt')]);
		const paths = await new ProviderConfig({ home, codexHome }).paths('codex');
		expect(paths.readPaths.slice().sort()).toEqual((await realPaths(files)).sort());
		expect(paths.exactReadDirectories).toEqual([await fs.realpath(rules)]);
	}));

test('Claude falls back to synthetic home config and receives no Codex rules', async () =>
	withRoot(async (home) => {
		const claude = join(home, '.claude');
		const files = [join(claude, '.credentials.json'), join(claude, 'settings.json')];
		await createFiles([...files, join(home, '.codex/rules/ignored.rules')]);
		const paths = await new ProviderConfig({ home, codexHome: join(home, '.codex') }).paths(
			'claude'
		);
		expect(paths.readPaths.slice().sort()).toEqual((await realPaths(files)).sort());
		expect(paths.exactReadDirectories).toEqual([]);
	}));

test('missing optional Codex config and rules paths are omitted', async () =>
	withRoot(async (home) => {
		const codexHome = join(home, '.codex');
		const auth = join(codexHome, 'auth.json');
		await createFiles([auth]);
		const paths = await new ProviderConfig({ home, codexHome }).paths('codex');
		expect(paths.readPaths).toEqual([await fs.realpath(auth)]);
		expect(paths.exactReadDirectories).toEqual([]);
	}));

test.each(['symlink', 'hardlink'] as const)(
	'rejects escaping Codex %s aliases without reading them',
	async (kind) =>
		withRoot(async (home) => {
			const codexHome = join(home, '.codex');
			const auth = join(codexHome, 'auth.json');
			const outside = join(home, 'synthetic-outside');
			await createFiles([outside]);
			await fs.mkdir(codexHome, { recursive: true });
			if (kind === 'symlink') await fs.symlink(outside, auth);
			else await fs.link(outside, auth);
			await expect(new ProviderConfig({ home, codexHome }).paths('codex')).rejects.toThrow();
		})
);
