// @harness-uid u_evpsejqo7k
import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
import type { BrowserApi } from '../../utils/browserApi';
import type {
	HomeChatInput,
	HomeChatReceipt
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { ReadHomeResult } from './hubHomeView.types';

/** Whose Home is read, and where each answer goes. */
export interface HubHomeReadOptions {
	api: BrowserApi;
	actor: () => string | undefined;
	home: (result: ReadHomeResult) => void;
	linked: (result: LinkedHome) => void;
}

/** `read` fetches both sources again; `close` ends the reads and the linked connections. */
export interface HubHomeReads {
	read: () => void;
	/** Null when no linked computer takes this write; the Hub queue is then the only path. */
	chat: (message: HomeChatInput) => Promise<HomeChatReceipt | null>;
	close: () => void;
}
