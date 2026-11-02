// @harness-uid u_gkqforuxtp
import type { CollaborationApi } from 'collaboration';
import type { SourceHistoryAdapter } from 'collaboration';
import type { CollaborationCache } from 'collaboration';

export interface Dependencies {
	api: CollaborationApi;
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
}
