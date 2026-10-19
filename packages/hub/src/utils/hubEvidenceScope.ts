import type { CollaborationApi, CollaborationCache, SourceHistoryAdapter } from 'collaboration';

export interface HubEvidenceDependencies {
	api: CollaborationApi;
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
}

export {
	hubEvidenceContext,
	hubEvidencePins,
	hubEvidenceScope
} from '../services/hub-evidence-service/hubEvidenceScope';
