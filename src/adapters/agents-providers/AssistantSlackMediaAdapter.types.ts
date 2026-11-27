// @harness-uid u_sceg2tkujc
import type { SlackAdapterConfig } from './SlackAdapter.types';

export type AssistantSlackMediaAdapterConfig = Pick<
	SlackAdapterConfig,
	'installation' | 'vault' | 'audit'
> & {
	channels: readonly string[];
};

export interface AssistantSlackHistoryRow {
	ts: string;
	text: string;
}
