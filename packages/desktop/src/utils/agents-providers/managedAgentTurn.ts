import type { ResourceContext } from '../../../../../src/core/execution-runtimes/resourceTypes';
import type { ResourceQueueService } from '../../../../../src/services/execution-runtimes/ResourceQueueService';
import { resourceWork } from '../../../../../src/utils/execution-runtimes/resourceWork';
import { RunCancelled, type AgentTurn } from '../../models/agents-providers/AgentRunner.types';
/** One machine-wide reservation covers an agent and its bounded nested test budget. */
export async function managedAgentTurn<T>(
	turn: AgentTurn,
	action: (context: ResourceContext) => Promise<T>,
	queue?: ResourceQueueService
): Promise<T> {
	try {
		const request = {
			priority: 'coding' as const,
			memoryMiB: 2048,
			label: 'Desktop coding task'
		};
		const options = {
			signal: turn.signal,
			onWaiting: (reason: string) => turn.onStatus('Waiting for resources: ' + reason)
		};
		if (queue) return await queue.run({ ...request, cpus: 1 }, action, options);
		return await resourceWork(request, action, process.env, options);
	} catch (error) {
		if (turn.signal.aborted) throw new RunCancelled();
		throw error;
	}
}
