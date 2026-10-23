import type { RpcPending } from '../rpcMessages';
import type { RpcEvent } from '../rpcMessages';

export interface RpcState {
	pending: Map<number, RpcPending>;
	listeners: Set<(event: RpcEvent) => void>;
	send: (value: unknown) => void;
}
