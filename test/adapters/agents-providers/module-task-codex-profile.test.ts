import { expect, test, vi } from 'vitest';
import { join } from 'node:path';
import { ModuleTaskCodexProfileAdapter } from '../../../src/adapters/agents-providers/ModuleTaskCodexProfileAdapter';
import { TestExpectationService } from '../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../src/core/development-tooling/unitTypes';
import manifest from '../../../specification/units/adapter.agents-providers-module-task-codex-profile.json' with { type: 'json' };
import { measureWorkload } from '../../support/measureWorkload';
import {
	assertUnsafeProfiles,
	defaultProfileFixture,
	profileFixture
} from './module-task-codex-profile.test.fixtures';

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

function agentSettings(args: string[]) {
	const settings = configOverrides(args);
	return {
		agentsDisabled: settings.includes('agents.enabled=false'),
		agentV2Disabled: settings.includes('features.multi_agent_v2=false')
	};
}

function assertRequestedGrants(config: string, f: Awaited<ReturnType<typeof profileFixture>>) {
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
		assertRequestedGrants(configOverrides(prepared.args).join('\n'), f);
		expect(JSON.stringify(prepared.env)).not.toMatch(
			/synthetic-openai-secret|synthetic-github-secret/
		);
		expect(prepared.env.OPENAI_API_KEY).toBeUndefined();
		expect(prepared.env.GITHUB_TOKEN).toBeUndefined();
		expect(f.input).toEqual(before);
		return agentSettings(prepared.args);
	} finally {
		await prepared?.cleanup();
		vi.unstubAllEnvs();
		await f.dispose();
	}
}

async function assertDefaultProfile() {
	const f = await defaultProfileFixture();
	const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
	vi.stubGlobal('Bun', { which: () => f.pinnedExecutable });
	Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
	let prepared: Awaited<ReturnType<ModuleTaskCodexProfileAdapter['prepare']>> | undefined;
	try {
		const adapter = new ModuleTaskCodexProfileAdapter();
		prepared = await adapter.prepare(f.input);
		expect(prepared.command).toBe(f.pinnedExecutable);
		assertNativeArgs(prepared.args);
		assertRequestedGrants(configOverrides(prepared.args).join('\n'), f);
		await expect(adapter.prepare({ ...f.input, argv: ['sh', 'exec'] })).rejects.toThrow(
			'Expected explicit Codex exec arguments.'
		);
		return { profilePrepared: true, unsafeArgRejected: true, ...agentSettings(prepared.args) };
	} finally {
		await prepared?.cleanup();
		Object.defineProperty(process, 'platform', platform);
		vi.unstubAllGlobals();
		await f.dispose();
	}
}

new TestExpectationService().registerCases(
	test,
	manifest as ComponentManifest,
	'test/adapters/agents-providers/module-task-codex-profile.test.ts',
	{
		'connect.default': () => {
			expect(() => new ModuleTaskCodexProfileAdapter(null as never).connect()).toThrow(TypeError);
			return new ModuleTaskCodexProfileAdapter().connect();
		},
		'connect.named': () => new ModuleTaskCodexProfileAdapter({ name: 'custom' }).connect(),
		'prepare.default': () => assertDefaultProfile(),
		'prepare.named': async () => {
			const settings = await measureWorkload(
				'adapter.agents-providers-module-task-codex-profile',
				'native-profile-permission-scope',
				assertNativeProfile
			);
			await assertUnsafeProfiles();
			return { requestedGrantsVerified: true, aliasesRejected: true, ...settings };
		}
	}
);
