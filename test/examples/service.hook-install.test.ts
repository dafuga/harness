import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import { HookInstallService } from '../../src/cli/program/hook-install-service/HookInstallService';
import type { HookStatus } from '../../src/cli/program/hook-install-service/HookInstallService.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

function summary(status: HookStatus) {
	return {
		installed: status.installed,
		enabled: status.enabled,
		stage: status.stage,
		chained: status.chained,
		stages: status.stages,
		limitations: status.limitations
	};
}

test('Reports the current hook status', async () => {
	await withTempRepo(async (repository) => {
		const status = await new HookInstallService(repository.root).status();
		expect(status.installed).toBe(false);
		expect(status.stages).toHaveLength(2);
		recordExampleCases(
			{
				unitId: 'service.hook-install',
				symbol: 'HookInstallService.status',
				state: 'reports-the-current-hook-status',
				evidence: 'examples-cases',
				file: 'reports-the-current-hook-status.json'
			},
			[{ name: 'fresh repository has no installed or enabled hooks', input: { root: 'temporary git repository' }, output: summary(status) }]
		);
	});
});

test('Installs wrappers and chains an existing hook', async () => {
	await withTempRepo(async (repository) => {
		const hooks = resolve(repository.root, repository.git('rev-parse', '--git-path', 'hooks'));
		const original = '#!/bin/sh\necho existing-hook\n';
		writeFileSync(join(hooks, 'pre-push'), original);
		const status = await new HookInstallService(repository.root).install('  harness  ');
		expect(status.enabled).toBe(true);
		expect(status.stages.find((stage) => stage.stage === 'pre-push')?.chained).toBe(true);
		expect(readFileSync(join(hooks, 'pre-push.harness-chained'), 'utf8')).toBe(original);
		recordExampleCases(
			{
				unitId: 'service.hook-install',
				symbol: 'HookInstallService.install',
				state: 'installs-wrappers-and-chains-an-existing-hook',
				evidence: 'examples-cases',
				file: 'installs-wrappers-and-chains-an-existing-hook.json'
			},
			[{ name: 'trimmed command enables each stage and preserves prior hook bytes', input: { command: '  harness  ', existingHook: original }, output: summary(status) }]
		);
	});
});

test('Uninstalls wrappers and restores the chained hook', async () => {
	await withTempRepo(async (repository) => {
		const hooks = resolve(repository.root, repository.git('rev-parse', '--git-path', 'hooks'));
		const original = '#!/bin/sh\nexit 0\n';
		writeFileSync(join(hooks, 'pre-push'), original);
		const service = new HookInstallService(repository.root);
		await service.install('harness');
		const status = await service.uninstall();
		expect(status.installed).toBe(false);
		expect(readFileSync(join(hooks, 'pre-push'), 'utf8')).toBe(original);
		recordExampleCases(
			{
				unitId: 'service.hook-install',
				symbol: 'HookInstallService.uninstall',
				state: 'uninstalls-wrappers-and-restores-the-chained-hook',
				evidence: 'examples-cases',
				file: 'uninstalls-wrappers-and-restores-the-chained-hook.json'
			},
			[{ name: 'removing the last opt-in restores the prior hook byte for byte', input: { command: 'harness', existingHook: original }, output: summary(status) }]
		);
	});
});
