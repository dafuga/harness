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
} from '../routes/api/[...path]/hub-projection-service/hub-evidence-service/hubEvidenceScope';
