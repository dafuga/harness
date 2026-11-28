import type {
	HomeChatReceipt,
	SendHomeChat
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { ReadHomeResult } from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
import type { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
import type { HubHomeReads } from './hubHomeReads.types';

/** The one Home reading of a signed-in page, shared by Home and the agents dock. */
export interface HubHomeSource {
	/** The Hub's stored Home; null until it has answered. */
	readonly home: ReadHomeResult | null;
	/** The linked computers' own answer; null until the first one arrives. */
	readonly live: LinkedHome | null;
	/** The newest of both, listed as Home shows it. */
	readonly snapshot: ReturnType<typeof listedHomeSnapshot> | null;
	readonly controlled: string[];
	readonly link: RealtimeState | null;
	readonly now: number;
	send: SendHomeChat;
	receipt: (id: string) => Promise<HomeChatReceipt>;
	readDocument: HubHomeReads['readDocument'];
	/** Reads the Home and the linked computers again. */
	refresh: () => void;
	setControlled: (controlled: string[]) => void;
	/** Hears every full refresh, so a page can read its own data on the same beat. */
	onRefresh: (listener: () => void) => () => void;
}
