import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import {
	cooldownFile,
	readCooldowns,
	recordCooldown
} from '../../../src/services/agents-providers/module-task-worker-service/providerCooldown';
import type { TaskRunInput } from '../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';

async function queued(extra: Record<string, unknown> = {}) {
	const f = await moduleTaskFixture();
	const service = new ModuleTaskService(f.root);
	await service.feature({ id: 'checkout', goal: 'Reliable checkout', tldr: 'Validated orders.' });
	await service.add(JSON.parse(await readFile(await f.input(extra), 'utf8')));
	const calls: string[] = [];
	const worker = new ModuleTaskWorkerService(f.root, {
		run: async (input: TaskRunInput) => {
			calls.push(input.model);
			await writeFile(join(input.cwd, 'src/orders.ts'), 'export const orders = 2;\n');
			const { provider, model, intelligence } = input;
			return { provider, model, intelligence, text: 'Done', reportedModel: model };
		}
	});
	const task = async () => (await service.show('orders-validation')).task;
	return { f, worker, calls, task };
}

test('an exhausted provider quota blocks dispatch until its reset without charging an attempt', async () => {
	const { f, worker, calls, task } = await queued();
	try {
		await recordCooldown(f.root, 'claude', 4e9);
		expect((await readCooldowns(f.root)).claude?.until).toBe(new Date(4e12).toISOString());
		const blocked = await worker.once('owner');
		expect(blocked).toMatchObject({ status: 'blocked' });
		expect(blocked.status === 'blocked' && blocked.problems[0]).toContain('claude quota');
		expect(calls).toEqual([]);
		expect(await task()).toMatchObject({ status: 'queued', claimHistory: [], attempts: [] });
		await writeFile(await cooldownFile(f.root), JSON.stringify({ claude: expired() }));
		expect((await worker.once('owner')).status).toBe('review');
		expect(calls).toEqual(['claude-haiku-5-5']);
	} finally {
		await f.dispose();
	}
});

test('a cooldown without a reported reset pauses for the default window only', async () => {
	const { f, worker, calls } = await queued({ model: 'gpt-6-luna', intelligence: 'max' });
	try {
		await recordCooldown(f.root, 'claude', undefined, Date.now());
		const until = Date.parse((await readCooldowns(f.root)).claude!.until);
		expect(until - Date.now()).toBeGreaterThan(14 * 60 * 1000);
		expect(until - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);
		expect((await worker.once('owner')).status, 'another provider still runs').toBe('review');
		expect(calls).toEqual(['gpt-6-luna']);
	} finally {
		await f.dispose();
	}
});

test('missing required tools block only the tasks that need them', async () => {
	const { f, worker, calls, task } = await queued({ requiredTools: ['ffmpeg-harness-missing'] });
	try {
		const blocked = await worker.once('owner');
		expect(blocked.status === 'blocked' && blocked.problems[0]).toContain(
			'Required tool ffmpeg-harness-missing is not on PATH.'
		);
		expect(calls).toEqual([]);
		expect((await task()).status).toBe('queued');
	} finally {
		await f.dispose();
	}
	const present = await queued({ requiredTools: ['git'] });
	try {
		expect((await present.worker.once('owner')).status).toBe('review');
	} finally {
		await present.f.dispose();
	}
});

test('an unwritable task worktree directory blocks before any claim (EPERM, EACCES)', async () => {
	const { f, worker, calls, task } = await queued();
	const directory = join(f.root, '.cache/harness/task-worktrees');
	try {
		await mkdir(directory, { recursive: true });
		await chmod(directory, 0o500);
		const blocked = await worker.once('owner');
		expect(blocked.status === 'blocked' && blocked.problems[0]).toMatch(
			/task-worktrees is not writable \((EACCES|EPERM)\)/
		);
		expect(calls).toEqual([]);
		expect(await task()).toMatchObject({ status: 'queued', claimHistory: [] });
	} finally {
		await chmod(directory, 0o700);
		await f.dispose();
	}
});

function expired() {
	const past = new Date(Date.now() - 1000).toISOString();
	return { until: past, recordedAt: past };
}
