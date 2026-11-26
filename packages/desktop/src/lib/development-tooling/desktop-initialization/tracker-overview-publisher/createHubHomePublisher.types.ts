// @harness-uid u_s7u2mjlzu4
import type { HomeChatInput } from '../../../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

/** What Hub answers a Home publish with. Older Hubs send no wanted documents. */
export interface HubHomeReply {
	messages?: HomeChatInput[];
	wantDocs?: { itemId?: string; id?: string }[];
}
