import type { SourceHistoryAdapter } from 'collaboration';
import type { Project } from 'collaboration';
import type { SourceEntry } from 'collaboration';
import type { CacheIdentity } from 'collaboration';
import type { CollaborationCache } from 'collaboration';

export interface HubSourceContext {
	metadata?: Map<string, Uint8Array>;
	metadataPending?: Promise<void>;
	source: SourceHistoryAdapter;
	repository: Project['sourceRepository'];
	commit: string;
	entries: SourceEntry[];
	identity: CacheIdentity;
	cache: CollaborationCache;
}
