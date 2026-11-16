// @harness-uid u_5nixbr5ktz
import type { RpcPending } from '../rpcMessages';
import type { RpcEvent } from '../rpcMessages';

export interface RpcState {
	pending: Map<number, RpcPending>;
	listeners: Set<(event: RpcEvent) => void>;
	send: (value: unknown) => void;
}
/** A Codex RPC request that Codex answered with an error, or that timed out without an answer. */
export class CodexRpcError extends Error {
	override name = 'CodexRpcError';
}
