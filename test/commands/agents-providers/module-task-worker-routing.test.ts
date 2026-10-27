import { Command } from 'commander';
import { expect, test, vi } from 'vitest';
import { ModuleTaskCommand } from '../../../src/commands/agents-providers/ModuleTaskCommand';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';

test('worker command uses only the trusted in-process collaborator when supplied', async () => {
	const fallback = vi
		.spyOn(ModuleTaskWorkerService.prototype, 'once')
		.mockResolvedValue({ status: 'idle' });
	const output = vi.spyOn(console, 'log').mockImplementation(() => {});
	const worker = {
		once: vi
			.fn()
			.mockResolvedValueOnce({ status: 'idle' })
			.mockResolvedValueOnce({ status: 'failed' })
	};
	const program = new Command().exitOverride();
	new ModuleTaskCommand({} as never, {} as never, worker).register(program.command('task'));
	const previous = process.exitCode;
	process.exitCode = 0;
	try {
		await program.parseAsync([
			'node',
			'harness',
			'task',
			'worker',
			'--worker',
			'owner',
			'--modules',
			'service.orders,page.cart',
			'--once'
		]);
		expect(worker.once).toHaveBeenCalledExactlyOnceWith(
			'owner',
			['service.orders', 'page.cart'],
			expect.any(AbortSignal)
		);
		expect(fallback).not.toHaveBeenCalled();
		await program.parseAsync(['node', 'harness', 'task', 'worker', '--worker', 'owner', '--once']);
		expect(process.exitCode).toBe(1);
		const options = program.commands[0].commands.find(
			(entry) => entry.name() === 'worker'
		)!.options;
		expect(options.map((option) => option.long)).not.toContain('--qualified');
	} finally {
		process.exitCode = previous;
		fallback.mockRestore();
		output.mockRestore();
	}
});

test('assign routes the task and required worker to the service without running a worker', async () => {
	const result = { value: { id: 'task.alpha', assignee: 'worker-a' }, commit: 'queue-commit' };
	const service = { assign: vi.fn().mockResolvedValue(result) };
	const worker = { once: vi.fn() };
	const output = vi.spyOn(console, 'log').mockImplementation(() => {});
	const program = new Command().exitOverride();
	new ModuleTaskCommand(service as never, {} as never, worker).register(program.command('task'));
	try {
		await program.parseAsync([
			'node',
			'harness',
			'task',
			'assign',
			'task.alpha',
			'--worker',
			'worker-a'
		]);
		expect(service.assign).toHaveBeenCalledExactlyOnceWith('task.alpha', 'worker-a');
		expect(output).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
		expect(worker.once).not.toHaveBeenCalled();
		await expect(
			program.parseAsync(['node', 'harness', 'task', 'assign', 'task.alpha'])
		).rejects.toThrow();
		expect(service.assign).toHaveBeenCalledTimes(1);
	} finally {
		output.mockRestore();
	}
});
