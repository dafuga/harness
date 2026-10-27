import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, beforeAll, vi } from 'vitest';
import { ModuleTaskProviderConfigAdapter } from '../../../src/adapters/agents-providers/ModuleTaskProviderConfigAdapter';
import { taskProcess } from '../../../src/adapters/agents-providers/module-task-runner-adapter/taskProcess';
import { makeTaskInput } from './module-task-runner.test.fixtures';

export const expectedSandboxEnvironment = {
	CLAUDE_CONFIG_DIR: '/tmp/synthetic-claude',
	CODEX_HOME: '/tmp/synthetic-codex',
	HARNESS_TASK_CONTRACT_SNAPSHOT: '/tmp/synthetic-contract.json',
	ANTHROPIC_API_KEY: null,
	OPENAI_API_KEY: null,
	CLAUDE_CODE_OAUTH_TOKEN: null
};

/** Inspect only synthetic values in a real disposable process. */
export async function runTrustedEnvironmentProbe() {
	const keys = Object.keys(expectedSandboxEnvironment);
	const script = `process.stdout.write(JSON.stringify(Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, process.env[key] ?? null]))))`;
	const result = await taskProcess([process.execPath, '-e', script], {
		...makeTaskInput(),
		env: {
			PATH: '/usr/bin:/bin',
			HOME: '/tmp/synthetic-home',
			CLAUDE_CONFIG_DIR: expectedSandboxEnvironment.CLAUDE_CONFIG_DIR,
			CODEX_HOME: expectedSandboxEnvironment.CODEX_HOME,
			HARNESS_TASK_CONTRACT_SNAPSHOT: expectedSandboxEnvironment.HARNESS_TASK_CONTRACT_SNAPSHOT,
			ANTHROPIC_API_KEY: 'synthetic-api-key',
			OPENAI_API_KEY: 'synthetic-api-key',
			CLAUDE_CODE_OAUTH_TOKEN: 'synthetic-token'
		}
	});
	if (result.code !== 0) throw new Error('Synthetic task process did not complete');
	return JSON.parse(result.stdout) as Record<string, string | null>;
}

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
