import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, beforeAll, vi } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';

/** Synthetic runner cases never depend on installed providers or real credential paths. */
export function isolateRunnerEnvironment() {
	const originalPath = process.env.PATH;
	let directory = '';
	let restoreConfig = () => {};
	beforeAll(async () => {
		directory = await mkdtemp(join(tmpdir(), 'harness-synthetic-providers-'));
		for (const name of ['claude', 'codex']) {
			const executable = join(directory, name);
			await writeFile(executable, '#!/bin/sh\nexit 97\n');
			await chmod(executable, 0o755);
		}
		process.env.PATH = [directory, originalPath].filter(Boolean).join(delimiter);
		const config = vi.spyOn(ModuleTaskProviderConfigAdapter.prototype, 'paths');
		config.mockResolvedValue({ readPaths: [], exactReadDirectories: [] });
		restoreConfig = () => config.mockRestore();
	});
	afterAll(async () => {
		restoreConfig();
		if (originalPath === undefined) delete process.env.PATH;
		else process.env.PATH = originalPath;
		if (directory) await rm(directory, { recursive: true, force: true });
	});
}
