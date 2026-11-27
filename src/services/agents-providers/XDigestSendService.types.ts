// @harness-uid u_x2f4mju4ib
import type { PlatformSendResult } from '../../core/agents-providers/platformAdapter.types';
import type { XDigestSendState } from '../../core/agents-providers/xDigestSend.types';

export interface XDigestSendPorts {
	/** The day's outbox file, or undefined while it cannot be fetched. */
	fetch(day: string): Promise<string | undefined>;
	state: { load(): Promise<XDigestSendState>; save(state: XDigestSendState): Promise<void> };
	send(text: string): Promise<PlatformSendResult>;
	ask(question: string): Promise<void>;
	now?: () => Date;
}
