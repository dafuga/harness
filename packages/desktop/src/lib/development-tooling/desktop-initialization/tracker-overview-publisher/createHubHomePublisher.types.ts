import type { HomeChatInput } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

/** What Hub answers a Home publish with. Older Hubs send no wanted documents. */
export interface HubHomeReply {
	messages?: HomeChatInput[];
	wantDocs?: unknown;
}
