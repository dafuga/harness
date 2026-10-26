import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { buildProgram } from '../../../src/cli/program';
import { ModuleTaskCommand } from '../../../src/commands/agents-providers/ModuleTaskCommand';
import { measureWorkload } from '../../support/measureWorkload';

const fullPlan = {
	schemaVersion: 1,
	feature: { id: 'contract-first-execution', goal: 'Run scoped work', tldr: 'Complete plan.' },
	modules: [{ id: 'module.alpha', files: ['src/alpha.ts'] }],
	tasks: [{ id: 'task.alpha', module: 'module.alpha', model: 'gpt-6-luna', intelligence: 'max' }],
	metadata: { revision: 'plan-revision-7', exactFileGrants: ['src/alpha.ts'] }
};
const registerTask = (service: unknown, server: unknown) => {
	const program = new Command().exitOverride();
	new (ModuleTaskCommand as any)(service, server).register(program.command('task').exitOverride());
	return program;
};
const withPlan = async (contents: string, run: (input: string) => Promise<unknown>) => {
	const directory = await mkdtemp(join(tmpdir(), 'harness-task-serve-'));
	const input = join(directory, 'plan.json');
	try {
		await writeFile(input, contents);
		return await run(input);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
};
const serveArgs = (input: string, extra: string[] = []) => [
	'node',
	'harness',
	'task',
	'serve',
	'--input',
	input,
	'--worker',
	'worker-luna',
	...extra
];
test('module task commands retain the existing evidence-based task check', () =>
	measureWorkload('command.agents-providers-module-task', 'module-task-command-discovery', () => {
		const task = buildProgram().commands.find((c) => c.name() === 'task')!;
		expect(
			task.commands.map((c) => c.name()),
			'module task commands must be discoverable'
		).toEqual(
			expect.arrayContaining(
				'check feature add show list prompt worker retry review sync'.split(' ')
			)
		);
		expect(task.commands.find((c) => c.name() === 'add')!.options.map((o) => o.long)).toEqual(
			expect.arrayContaining(['--input', '--model', '--intelligence', '--assignee'])
		);
	}));

test('serve delegates the full plan and repeated module filter exactly once', async () => {
	const service = { add: vi.fn() };
	const server = {
		run: vi.fn(
			async (
				_plan: unknown,
				_options: { worker: string; modules?: string[]; once: boolean; signal: AbortSignal }
			) => ({ status: 'review', task: 'task.alpha' })
		)
	};
	await withPlan(JSON.stringify(fullPlan), (input) =>
		registerTask(service, server).parseAsync(
			serveArgs(input, ['--module', 'module.alpha', '--module', 'module.beta', '--once', '--json'])
		)
	);
	expect(server.run).toHaveBeenCalledTimes(1);
	expect(server.run.mock.calls[0]).toEqual([
		fullPlan,
		{
			worker: 'worker-luna',
			modules: ['module.alpha', 'module.beta'],
			once: true,
			signal: expect.any(AbortSignal)
		}
	]);
	expect(service.add).not.toHaveBeenCalled();
});

test('invalid plan JSON fails before server delegation', async () => {
	const service = { add: vi.fn() };
	const server = { run: vi.fn(async () => ({ status: 'idle' })) };
	await withPlan('{invalid', (input) =>
		expect(registerTask(service, server).parseAsync(serveArgs(input))).rejects.toThrow()
	);
	expect(server.run).not.toHaveBeenCalled();
	expect(service.add).not.toHaveBeenCalled();
});

test('serve propagates server rejection without manual fallback', async () => {
	const failure = new Error('server rejected plan');
	const service = { add: vi.fn() };
	const server = { run: vi.fn(async () => Promise.reject(failure)) };
	await withPlan(JSON.stringify(fullPlan), (input) =>
		expect(registerTask(service, server).parseAsync(serveArgs(input))).rejects.toThrow(
			failure.message
		)
	);
	expect(server.run).toHaveBeenCalledTimes(1);
	expect(service.add).not.toHaveBeenCalled();
});

const restoreSignalListeners = (
	event: 'SIGINT' | 'SIGTERM',
	baseline: Function[],
	foreign: () => void
) => {
	process
		.listeners(event)
		.filter((listener) => !baseline.includes(listener))
		.forEach((listener) => process.removeListener(event, listener as (...args: any[]) => void));
	if (!process.listeners(event).includes(foreign)) process.on(event, foreign);
	process.removeListener(event, foreign);
};
const pendingServer = () => {
	let settle: ((error: Error) => void) | undefined;
	let settled = false,
		abortObserved = false;
	const server = {
		run: vi.fn(
			(
				_plan: unknown,
				options: { worker: string; modules?: string[]; once: boolean; signal: AbortSignal }
			) => {
				options.signal.addEventListener('abort', () => (abortObserved = true), { once: true });
				return new Promise<unknown>((_resolve, reject) => {
					settle = (error) => {
						settled = true;
						reject(error);
					};
				});
			}
		)
	};
	return {
		server,
		settle: (error: Error) => settle?.(error),
		settled: () => settled,
		abortObserved: () => abortObserved
	};
};
const interrupt = (event: 'SIGINT' | 'SIGTERM', baseline: Function[]) => {
	const handler = process.listeners(event).find((listener) => !baseline.includes(listener));
	expect(handler).toBeDefined();
	(handler as (() => void) | undefined)?.();
};
test.each(['SIGINT', 'SIGTERM'] as const)(
	'serve %s abort awaits server settlement and restores only owned listeners',
	async (event) => {
		const originalInt = process.listeners('SIGINT'),
			originalTerm = process.listeners('SIGTERM');
		const foreignInt = () => undefined;
		const foreignTerm = () => undefined;
		process.on('SIGINT', foreignInt);
		process.on('SIGTERM', foreignTerm);
		const baselineInt = process.listeners('SIGINT'),
			baselineTerm = process.listeners('SIGTERM');
		const pending = pendingServer(),
			service = { add: vi.fn() };
		let cliSettled = false,
			parsing: Promise<{ error?: unknown }> | undefined;
		try {
			await withPlan(JSON.stringify(fullPlan), async (input) => {
				parsing = registerTask(service, pending.server)
					.parseAsync(serveArgs(input))
					.then(
						() => {
							cliSettled = true;
							return {};
						},
						(error: unknown) => {
							cliSettled = true;
							return { error };
						}
					);
				await vi.waitFor(() => expect(pending.server.run).toHaveBeenCalledTimes(1));
				const baseline = event === 'SIGINT' ? baselineInt : baselineTerm;
				interrupt(event, baseline);
				const call = pending.server.run.mock.calls[0];
				const signal = call?.[1].signal;
				expect(signal.aborted).toBe(true);
				expect(call?.[1].once).toBe(false);
				expect(pending.abortObserved()).toBe(true);
				await new Promise((resolve) => setTimeout(resolve, 0));
				expect(pending.settled()).toBe(false);
				expect(cliSettled).toBe(false);
				pending.settle(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
				expect((await parsing).error).toMatchObject({ name: 'AbortError' });
				expect(pending.settled()).toBe(true);
				expect(cliSettled).toBe(true);
				expect(process.listeners('SIGINT')).toEqual(baselineInt);
				expect(process.listeners('SIGTERM')).toEqual(baselineTerm);
				expect(service.add).not.toHaveBeenCalled();
			});
		} finally {
			pending.settle(new Error('test cleanup'));
			await parsing;
			restoreSignalListeners('SIGINT', baselineInt, foreignInt);
			restoreSignalListeners('SIGTERM', baselineTerm, foreignTerm);
			expect(process.listeners('SIGINT')).toEqual(originalInt);
			expect(process.listeners('SIGTERM')).toEqual(originalTerm);
		}
	}
);
