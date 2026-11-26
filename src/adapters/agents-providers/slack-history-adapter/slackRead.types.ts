// @harness-uid u_bd5orhfrvh
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';

export type SlackReadMethod = 'auth.test' | 'conversations.history' | 'conversations.replies';

export interface SlackReadReply {
	ok?: boolean;
	error?: string;
	team_id?: string;
	url?: string;
	messages?: UntrustedValue;
	response_metadata?: { next_cursor?: string };
}
