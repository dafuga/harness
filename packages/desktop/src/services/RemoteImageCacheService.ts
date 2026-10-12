import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import type { ImageQuery } from '../models/DesktopBridge.types';
import type { ProjectionCacheService } from './ProjectionCacheService';
export class RemoteImageCacheService {
	constructor(private cache: ProjectionCacheService) {}
	async read(
		context: {
			identity: CacheIdentity;
			principalId: string;
			query: ImageQuery & { projectId: string };
		},
		load: () => Promise<Uint8Array>
	): Promise<Uint8Array> {
		const { identity, principalId, query } = context;
		if (
			identity.principalId !== principalId ||
			identity.projectId !== query.projectId ||
			identity.sourceCommit !== query.commit ||
			identity.artifactHash !== query.sha256
		)
			throw new Error('Hosted cache identity mismatch.');
		const fields = [
			'repositoryId',
			'requestedRef',
			'sourceTree',
			'notesRef',
			'notesRevision',
			'evidenceRef',
			'evidenceRevision',
			'historyIndexRevision',
			'profile'
		];
		if (fields.some((field) => !Object.hasOwn(identity, field)))
			throw new Error('Incomplete hosted cache identity.');
		const bytes = await this.cache.get(identity, query.sha256);
		if (bytes) return bytes;
		const fresh = await load();
		await this.cache.put(identity, fresh, query.sha256);
		return fresh;
	}
}
