import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { managedAgentTurn } from '../../src/utils/agents-providers/managedAgentTurn';
import { RunCancelled } from '../../src/models/agents-providers/AgentRunnerValues';

test('queues work and reports resource waiting', async () => {
	const statuses: string[] = [];
	const calls: Array<{ request: unknown; options: unknown }> = [];
	const turn = {
		model: 'example-model',
		effort: null,
		cwd: '/tmp/example-project',
		prompt: 'Summarize the project',
		access: 'read-only' as const,
		signal: new AbortController().signal,
		onText: (_text: string) => undefined,
		onStatus: (status: string) => statuses.push(status)
	};
	const queue = {
		run: async (
			request: unknown,
			action: (context: {
				id: string;
				env: Record<string, string | undefined>;
				track: (_pid: number) => void;
			}) => Promise<string>,
			options: { onWaiting: (reason: string) => void }
		) => {
			calls.push({ request, options });
			options.onWaiting('memory is in use');
			return action({ id: 'lease-1', env: {}, track: (_pid: number) => undefined });
		}
	} as unknown as Parameters<typeof managedAgentTurn>[2];
	const result = await managedAgentTurn(turn, async (context) => `finished:${context.id}`, queue);

	expect(result).toBe('finished:lease-1');
	expect(statuses).toEqual(['Waiting for resources: memory is in use']);
	expect(calls).toHaveLength(1);
	expect(calls[0]?.request).toEqual({
		priority: 'coding',
		memoryMiB: 2048,
		label: 'Desktop coding task',
		cpus: 1
	});
	const input = {
		turn: { model: turn.model, prompt: turn.prompt, signalAborted: turn.signal.aborted },
		queue: 'shared queue',
		waitingReason: 'memory is in use'
	};
	const output = { result, statuses, request: calls[0]?.request };
	recordExampleCases(
		{
			unitId: 'desktop.function.managed-agent-turn',
			symbol: 'managedAgentTurn',
			state: 'queues-work-and-reports-resource-waiting',
			evidence: 'examples-cases',
			file: 'queues-work-and-reports-resource-waiting.json'
		},
		[{ name: 'queued project work waits for memory then returns its result', input, output }]
	);
});

test('Throws RunCancelled when queued work fails after the turn is aborted', async () => {
	const controller = new AbortController();
	const turn = {
		model: 'example-model',
		effort: null,
		cwd: '/tmp/example-project',
		prompt: 'Summarize the project',
		access: 'read-only' as const,
		signal: controller.signal,
		onText: (_text: string) => undefined,
		onStatus: (_status: string) => undefined
	};
	const queue = {
		run: async () => {
			controller.abort();
			throw new Error('Reservation stopped');
		}
	} as unknown as Parameters<typeof managedAgentTurn>[2];
	let thrown: unknown;
	try {
		await managedAgentTurn(turn, async () => 'unused', queue);
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(RunCancelled);
	if (!(thrown instanceof RunCancelled)) throw new Error('Expected cancellation.');
	recordExampleCases(
		{
			unitId: 'desktop.function.managed-agent-turn',
			symbol: 'managedAgentTurn',
			state: 'throws-runcancelled-when-queued-work-fails-after-the-turn-is',
			evidence: 'examples-cases',
			file: 'throws-runcancelled-when-queued-work-fails-after-the-turn-is.json'
		},
		[
			{
				name: 'replace a queue failure after cancellation',
				input: { signalAbortedBeforeRun: false, queueError: 'Reservation stopped' },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
