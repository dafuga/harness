// @harness-uid u_evpsejqo7k
import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
import type { BrowserApi } from '../../utils/browserApi';
import type {
	HomeChatInput,
	HomeChatReceipt
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { ReadHomeResult } from '../../../../reports/src/components/projects-sessions/hub-home/hubHomeView.types';

/** Whose Home is read, and where each answer goes. */
export interface HubHomeReadOptions {
	api: BrowserApi;
	actor: () => string | undefined;
	home: (result: ReadHomeResult) => void;
	linked: (result: LinkedHome) => void;
}

/** `read` fetches both sources again, `computers` only the linked ones; `close` ends both. */
export interface HubHomeReads {
	read: () => void;
	/** A linked computer that showed the item takes the write itself; otherwise the Hub queues it. */
	send: (message: HomeChatInput) => Promise<HomeChatReceipt>;
	computers: () => void;
	close: () => void;
}
