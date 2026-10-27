import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../src/core/development-tooling/unitTypes';
import { ModuleTaskSandboxProcessAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxProcessAdapter';
import type { ModuleTaskSandboxInput } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter.types';
import { TestExpectationService } from '../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../specification/units/adapter.agents-providers-module-task-sandbox-process.json' with { type: 'json' };
import { measureWorkload } from '../../support/measureWorkload';

const scope: ModuleTaskSandboxInput = {
	cwd: '/tmp/harness-app',
	files: ['src/assigned.ts'],
	snapshot: '/tmp/harness-contracts.json',
	scratch: '/tmp/harness-scratch',
	readPaths: ['/tmp/harness-bin'],
	protectedPaths: [],
	binDirectory: '/tmp/harness-bin',
	argv: ['claude', '-p']
};
const defaults = new ModuleTaskSandboxProcessAdapter();
const named = new ModuleTaskSandboxProcessAdapter({ name: 'sandbox-worker' });
const unit = 'adapter.agents-providers-module-task-sandbox-process';

async function checkCommand(adapter: ModuleTaskSandboxProcessAdapter) {
	const root = await fs.mkdtemp(join(tmpdir(), 'harness-task-driver-'));
	try {
		const settings = join(root, 'settings.json');
		const wrapper = join(root, 'wrapper.mjs');
		const initialization = join(root, 'initialization.mjs');
		await Promise.all([
			fs.writeFile(settings, '{}'),
			fs.writeFile(
				wrapper,
				'export const SandboxManager = { initialize: async () => {}, wrapWithSandbox: async () => "unexpected wrapper", reset: async () => {} };'
			),
			fs.writeFile(
				initialization,
				'export const SandboxManager = { initialize: async () => { throw new Error("synthetic initialization failure"); } };'
			)
		]);
		const provider = ['provider', 'argument with spaces'];
		const command = adapter.command(wrapper, settings, provider);
		expect(command).toHaveLength(6);
		expect(command[0]).toBe(process.execPath);
		expect(command[1]).toBe('-e');
		expect(command.slice(3)).toEqual([wrapper, settings, JSON.stringify(provider)]);
		expect(command[2]).toContain('(deny file-link)');
		for (const sdk of [wrapper, initialization]) {
			const args = adapter.command(sdk, settings, provider);
			const child = spawnSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 10_000 });
			expect(child.error).toBeUndefined();
			expect(child.status).toBe(1);
			expect(child.stderr).toBe('Harness native task isolation unavailable.\n');
		}
		return {
			argvPreserved: true,
			hardlinksDenied: true,
			invalidWrapperRejected: true,
			initializationFailureRejected: true
		};
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

async function checkScratch(adapter: ModuleTaskSandboxProcessAdapter, boundary: boolean) {
	const root = await fs.mkdtemp(join(tmpdir(), 'harness-task-scratch-'));
	try {
		const file = join(root, 'value');
		const alias = join(root, 'alias');
		await fs.writeFile(file, 'fixture');
		await adapter.validateScratch(root);
		await fs.symlink(file, alias);
		await expect(adapter.validateScratch(root)).rejects.toThrow(/unsafe/i);
		await fs.unlink(alias);
		await fs.link(file, alias);
		await expect(adapter.validateScratch(root)).rejects.toThrow(/unsafe/i);
		await fs.unlink(alias);
		if (boundary) {
			for (let index = 0; index < 4094; index++)
				await fs.writeFile(join(root, `entry-${index}`), '');
			await adapter.validateScratch(root);
			await fs.writeFile(join(root, 'overflow'), '');
			await expect(adapter.validateScratch(root)).rejects.toThrow(/unsafe/i);
		}
	} finally {
		await fs.rm(root, { recursive: true, force: true });
	}
}

function checkArguments(adapter: ModuleTaskSandboxProcessAdapter) {
	expect(() => adapter.arguments(null as never)).toThrow(TypeError);
	return measureWorkload(unit, 'provider-argv', () => adapter.arguments(scope));
}

function checkEnvironment(adapter: ModuleTaskSandboxProcessAdapter) {
	expect(() => adapter.environment(null as never, '/tmp/harness-policy')).toThrow(TypeError);
	const previous = process.env.ANTHROPIC_API_KEY;
	const previousOpenai = process.env.OPENAI_API_KEY;
	process.env.ANTHROPIC_API_KEY = 'synthetic-not-a-credential';
	process.env.OPENAI_API_KEY = 'synthetic-not-a-credential';
	try {
		const env = adapter.environment(scope, '/tmp/harness-policy');
		return {
			tmpdir: env.TMPDIR,
			tmp: env.TMP,
			temp: env.TEMP,
			snapshot: env.HARNESS_TASK_CONTRACT_SNAPSHOT,
			pathMatches: env.PATH === `/tmp/harness-bin:${process.env.PATH ?? '/usr/bin:/bin'}`,
			apiKeysExcluded:
				!Object.hasOwn(env, 'ANTHROPIC_API_KEY') && !Object.hasOwn(env, 'OPENAI_API_KEY')
		};
	} finally {
		if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
		else process.env.ANTHROPIC_API_KEY = previous;
		if (previousOpenai === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = previousOpenai;
	}
}

new TestExpectationService().registerCases(
	test,
	manifest as ComponentManifest,
	'test/adapters/agents-providers/module-task-sandbox-process.test.ts',
	{
		'connect.default': () => {
			expect(defaults).toBeInstanceOf(ModuleTaskSandboxProcessAdapter);
			expect(() => new ModuleTaskSandboxProcessAdapter(null as never).connect()).toThrow(TypeError);
			return defaults.connect();
		},
		'connect.named': () => named.connect(),
		'command.default': () => checkCommand(defaults),
		'command.named': () => checkCommand(named),
		'validatescratch.default': () => checkScratch(defaults, true),
		'validatescratch.named': () => checkScratch(named, false),
		'arguments.default': () => checkArguments(defaults),
		'arguments.named': () => checkArguments(named),
		'environment.default': () => checkEnvironment(defaults),
		'environment.named': () => checkEnvironment(named)
	}
);
