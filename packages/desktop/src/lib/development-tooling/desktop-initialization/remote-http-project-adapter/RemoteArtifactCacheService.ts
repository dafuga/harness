import type { Query, Media } from './RemoteArtifactCacheService.types';
import type { CacheIdentity } from '../../../../../../collaboration/src/models/Collaboration.types';
import { HostedArtifactValidator } from '../../../../validators/development-tooling/HostedArtifactValidator';
import { artifactLimit } from '../../../../utils/development-tooling/artifactMedia';
import type { HostedReadService } from '../../../../services/development-tooling/HostedReadService';
/** Pinned identities authorize cache provenance; only the server authorizes online bytes. */
export class RemoteArtifactCacheService {
	private pinned = new Map<string, CacheIdentity>();
	private validator = new HostedArtifactValidator();
	constructor(private reads: HostedReadService) {}
	pin(identity: CacheIdentity) {
		const key = JSON.stringify(identity);
		this.pinned.delete(key);
		this.pinned.set(key, { ...identity });
		if (this.pinned.size > 64) this.pinned.delete(this.pinned.keys().next().value!);
	}
	async read(input: { key: string; query: Query }, load: () => Promise<Media>) {
		const query = { ...input.query };
		const validate = (value: unknown) => this.decode(value, query.sha256);
		const result = await this.reads.read(
			{ key: input.key, projectId: query.projectId },
			async () => {
				const media = await load(),
					checked = this.validator.artifact(media, query.sha256);
				const original = this.identity(query, media.principalId);
				return {
					value: {
						mediaType: checked.mediaType,
						data: Buffer.from(checked.bytes).toString('base64')
					},
					principalId: media.principalId,
					identity: original && { ...original, artifactHash: query.sha256 }
				};
			},
			(value) => {
				validate(value);
				return value as { mediaType: string; data: string };
			}
		);
		return validate(result.value);
	}
	private identity(q: Query, principalId: string) {
		return [...this.pinned.values()]
			.reverse()
			.find(
				(i) =>
					i.principalId === principalId &&
					i.projectId === q.projectId &&
					i.sourceCommit === q.commit &&
					i.requestedRef === q.branch &&
					i.notesRevision === q.notesRevision &&
					i.evidenceRevision === q.evidenceRevision
			);
	}
	private decode(value: unknown, hash: string) {
		const held = value as { mediaType?: unknown; data?: unknown };
		if (
			!held ||
			typeof held.mediaType !== 'string' ||
			typeof held.data !== 'string' ||
			held.data.length > Math.ceil(artifactLimit / 3) * 4
		)
			throw new Error('Invalid kept artifact or capture exceeds 11 MiB.');
		return this.validator.artifact(
			{ bytes: new Uint8Array(Buffer.from(held.data, 'base64')), mediaType: held.mediaType },
			hash
		);
	}
}
