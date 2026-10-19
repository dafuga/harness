import { RpcPending, RpcEvent } from '../rpcMessages';

interface RpcState {
	pending: Map<number, RpcPending>;
	listeners: Set<(event: RpcEvent) => void>;
	send: (value: unknown) => void;
}

export function rpcMessages(state: RpcState, line: string): void {
	let msg: Record<string, unknown>;
	try {
		msg = JSON.parse(line) as Record<string, unknown>;
	} catch {
		return;
	}
	if (typeof msg.id === 'number' && state.pending.has(msg.id)) answer(state, msg);
	else if (typeof msg.method === 'string') notification(state, msg);
}

function answer(state: RpcState, msg: Record<string, unknown>) {
	const id = msg.id as number,
		pending = state.pending.get(id)!;
	state.pending.delete(id);
	clearTimeout(pending.timer);
	if (msg.error)
		pending.reject(
			new Error(String((msg.error as { message?: string }).message ?? 'Codex RPC failed.'))
		);
	else pending.resolve(msg.result);
}

function notification(state: RpcState, msg: Record<string, unknown>) {
	if (msg.id !== undefined)
		state.send({
			id: msg.id,
			error: { code: -32601, message: 'Interactive requests are unavailable in Harness.' }
		});
	else state.listeners.forEach((listener) => listener(msg as RpcEvent));
}

export function rpcRequest(
	state: RpcState,
	frame: { id: number; method: string; params: unknown },
	timeoutMs: number
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			state.pending.delete(frame.id);
			reject(new Error('Codex ' + frame.method + ' timed out.'));
		}, timeoutMs);
		state.pending.set(frame.id, { resolve, reject, timer });
		try {
			state.send(frame);
		} catch (error) {
			state.pending.delete(frame.id);
			clearTimeout(timer);
			reject(error);
		}
	});
}
