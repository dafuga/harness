// @harness-uid u_5nixbr5ktz
export interface RpcEvent {
	method?: string;
	params?: Record<string, unknown>;
}

export interface RpcPending {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export { rpcMessages, rpcRequest } from './codex-rpc/rpcMessages';
