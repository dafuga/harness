import { expect } from '../verificationExpect';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { ModuleTaskRunnerAdapter } from '../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import { ModuleTaskService } from '../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../src/services/agents-providers/ModuleTaskWorkerService';
import { moduleTaskFixture } from './moduleTaskFixture';
import { taskEvents } from '../../src/services/agents-providers/module-task-analytics-service/taskEvents';
import { taskRunRecords } from '../../src/services/agents-providers/module-task-analytics-service/taskRunRecords';
import { observedTaskOperation } from './taskProfiles';

export async function assertDeclaredTaskCheck(outcome: 'repaired' | 'exhausted') {
	const f = await moduleTaskFixture();
	try {
		const service = new ModuleTaskService(f.root);
		await f.feature();
		const check = {
			argv: [
				process.execPath,
				'--input-type=module',
				'--eval',
				"const file = (await import('node:fs')).readFileSync('src/orders.ts', 'utf8'); if (!file.includes('orders = 3')) { console.error('Expected order count 3'); process.exit(1); }"
			]
		};
		await service.add(JSON.parse(await readFile(await f.input({ check }), 'utf8')));
		const { runner, calls, sessionId } = checkedTaskRunner(outcome === 'repaired');
		expect(await new ModuleTaskWorkerService(f.root, runner).once('owner')).toMatchObject({
			status: 'blocked'
		});
		expect(calls).toHaveLength(0);
		const worker = new ModuleTaskWorkerService(f.root, runner, undefined, true);
		const result = await observedTaskOperation(
			'service.agents-providers-module-task-worker',
			'declared-check-with-synthetic-provider',
			() => worker.once('owner')
		);
		const shown = (await service.show('orders-validation')).task;
		const repaired = outcome === 'repaired';
		expect(result.status).toBe(repaired ? 'review' : 'failed');
		expect(shown.result?.checkRounds).toMatchObject(
			repaired
				? [
						{ status: 'failed', exitCode: 1 },
						{ status: 'passed', exitCode: 0 }
					]
				: Array.from({ length: 4 }, () => ({ status: 'failed', exitCode: 1 }))
		);
		expect(shown.result?.executions).toHaveLength(repaired ? 2 : 4);
		const events = taskEvents([shown], f.root);
		expect(taskRunRecords(events, events)).toMatchObject([
			{ attempt: 1, escalations: 0, outcome: repaired ? 'pending_review' : 'failed' }
		]);
		expect(shown.result?.checkpointCommit).toMatch(/^[a-f0-9]{40}$/);
		expect(calls[0].command).not.toContain('resume');
		for (const call of calls.slice(1)) {
			expect(call.command).toContain('resume');
			expect(call.command).toContain(sessionId);
			expect(call.prompt).toContain('Expected order count 3');
			expect(call.cwd).toBe(calls[0].cwd);
		}
	} finally {
		await f.dispose();
	}
}

function checkedTaskRunner(repair: boolean) {
	const sessionId = '4de9edbc-d14a-4e0a-84aa-e95d62c17895';
	const calls: { command: string[]; prompt: string; cwd: string }[] = [];
	const runner = new ModuleTaskRunnerAdapter(async (command, { prompt, cwd }) => {
		calls.push({ command, prompt, cwd });
		const orders = repair && calls.length > 1 ? 3 : 2;
		await writeFile(join(cwd, 'src/orders.ts'), `export const orders = ${orders};\n`);
		return {
			code: 0,
			stdout: [
				JSON.stringify({ type: 'thread.started', thread_id: sessionId }),
				JSON.stringify({ type: 'turn.completed', model: 'gpt-6-luna' })
			].join('\n')
		};
	});
	return { runner, calls, sessionId };
}
