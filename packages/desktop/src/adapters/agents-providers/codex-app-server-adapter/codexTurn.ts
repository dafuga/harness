import type { TurnItem, TurnResult, TurnOptions } from './codexTurn.types';
export type { TurnItem, TurnResult, TurnOptions } from './codexTurn.types';
import type { ResourceContext } from '../../../../../../src/core/execution-runtimes/resourceTypes';
import type { ResourceQueueService } from '../../../../../../src/services/execution-runtimes/ResourceQueueService';
import type { AgentTurn, CliCommand } from '../../../models/agents-providers/AgentRunner.types';
import { RunCancelled } from '../../../models/agents-providers/AgentRunner.types';
import { codexRpc } from '../../../utils/agents-providers/codex-rpc/codexRpc';
import { managedAgentTurn } from '../../../utils/agents-providers/managedAgentTurn';
export async function codexTurn(
	command: CliCommand,
	turn: TurnOptions,
	queue?: ResourceQueueService
): Promise<TurnResult> {
	return managedAgentTurn(turn, (resources) => runCodexTurn(command, turn, resources), queue);
}
async function runCodexTurn(
	command: CliCommand,
	turn: TurnOptions,
	resources: ResourceContext
): Promise<TurnResult> {
	const rpc = await codexRpc(command, resources);
	if (turn.signal.aborted) {
		rpc.dispose();
		throw new RunCancelled();
	}
	try {
		const started = await rpc.request<{
			thread: { id: string };
			model: string;
			modelProvider: string;
		}>('thread/start', {
			model: turn.model,
			modelProvider: 'openai',
			cwd: turn.cwd,
			approvalPolicy: 'never',
			sandbox: turn.access === 'write' ? 'danger-full-access' : 'read-only',
			ephemeral: true,
			config: { 'features.image_generation': true },
			developerInstructions:
				'Follow the supplied unit contract. Do not delegate to other agents. Never claim verification from CLI success.'
		});
		if (started.model !== turn.model || started.modelProvider !== 'openai')
			throw new Error('Codex did not run the requested model/provider.');
		if (turn.signal.aborted) throw new RunCancelled();
		return await waitTurn(rpc, { turn, threadId: started.thread.id, model: started.model });
	} finally {
		rpc.dispose();
	}
}

async function waitTurn(
	rpc: Awaited<ReturnType<typeof codexRpc>>,
	context: { turn: TurnOptions; threadId: string; model: string }
): Promise<TurnResult> {
	const { turn, threadId, model } = context;
	return new Promise((resolve, reject) => {
		const texts: string[] = [],
			images: TurnItem[] = [];
		const complete = (error: Error | null) => {
			clearTimeout(timer);
			unsubscribe();
			turn.signal.removeEventListener('abort', cancel);
			if (error) reject(error);
			else resolve({ text: texts.join('\n'), model, images });
		};
		const cancel = () => {
			void rpc.request('turn/interrupt', { threadId, turnId }).catch(() => {});
			finish(new RunCancelled());
		};
		let turnId = '',
			settled = false;
		const finish = (error: Error | null) => {
			if (settled) return;
			settled = true;
			complete(error);
		};
		const timer = setTimeout(() => finish(new Error('Codex turn timed out.')), 900000);
		const unsubscribe = rpc.subscribe((event) =>
			turnNotification(event, { threadId, turn, texts, images, finish })
		);

		turn.signal.addEventListener('abort', cancel, { once: true });
		const input: unknown[] = [{ type: 'text', text: turn.prompt, text_elements: [] }];
		if (turn.reference) input.push({ type: 'localImage', path: turn.reference });
		void rpc
			.request<{ turn: { id: string } }>('turn/start', {
				threadId,
				input,
				model,
				effort: turn.effort,
				summary: 'none'
			})
			.then((result) => {
				turnId = result.turn.id;
				if (turn.signal.aborted) cancel();
			})
			.catch(finish);
	});
}

function publicItem(
	item: TurnItem,
	context: { texts: string[]; images: TurnItem[]; turn: TurnOptions }
): void {
	if (item.type === 'agentMessage' && item.text) {
		context.texts.push(item.text);
		context.turn.onText(item.text);
	}
	if (item.type === 'imageGeneration') {
		context.images.push(item);
		context.turn.onStatus('Image generation ' + item.status);
	}
	observePaths(item, context.turn);
}

function observePaths(item: TurnItem, turn: AgentTurn): void {
	if (item.type === 'fileChange') item.changes?.forEach((change) => turn.onFile?.(change.path));
}

function turnNotification(
	event: { method?: string; params?: Record<string, unknown> },
	context: {
		threadId: string;
		turn: TurnOptions;
		texts: string[];
		images: TurnItem[];
		finish: (error: Error | null) => void;
	}
) {
	const params = event.params;
	if (!params || params.threadId !== context.threadId) return;
	if (event.method === 'item/completed') publicItem(params.item as TurnItem, context);
	if (event.method === 'item/started') observePaths(params.item as TurnItem, context.turn);
	terminalNotification(event, context.finish);
}

function terminalNotification(
	event: { method?: string; params?: Record<string, unknown> },
	finish: (error: Error | null) => void
) {
	const params = event.params!;
	if (event.method === 'error' && !params.willRetry) {
		const error = params.error as { message?: string } | undefined;
		finish(new Error(error?.message ?? 'Codex failed.'));
	}
	if (event.method === 'turn/completed') {
		const result = params.turn as { status: string; error?: { message: string } };
		finish(
			result.status === 'completed'
				? null
				: new Error(result.error?.message ?? 'Codex turn ' + result.status)
		);
	}
}
