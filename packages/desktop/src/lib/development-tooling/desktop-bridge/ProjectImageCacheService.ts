import { createHash } from 'node:crypto';
import type { CacheIdentity } from '../../../../../collaboration/src/models/Collaboration.types';
import type { ImageQuery } from '../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import { gitRead } from '../../../utils/projects-sessions/gitRead';
/** Revalidates the project and exact design before consulting disposable bytes. */
export class ProjectImageCacheService {
	constructor(private session: ProjectSessionService) {}
	async read(input: ImageQuery): Promise<Uint8Array> {
		this.session.assertProject(input.projectId);
		const project = this.session.requireProject();
		const entity = await project.catalog.entity(input.entityId, input.commit);
		const image = entity.versions
			.find((version) => version.version === input.version)
			?.images.find(
				(image) =>
					image.sha256 === input.sha256 &&
					(input.option === undefined || image.option === input.option)
			);
		if (!image) throw new Error('Unknown project image.');
		const identity = await this.identity(input);
		const cached = await this.session.cache?.get(identity, input.sha256);
		if (cached && cached.length === image.bytes) return cached;
		const bytes = await project.planning.image({ ...input, revision: input.commit });
		if (
			bytes.length !== image.bytes ||
			createHash('sha256').update(bytes).digest('hex') !== input.sha256
		)
			throw new Error('Image hash mismatch.');
		await this.session.cache?.put(identity, bytes, input.sha256);
		return bytes;
	}
	private async identity(input: ImageQuery): Promise<CacheIdentity> {
		const { root } = this.session.requireProject();
		const refs = await gitRead(root, [
			'for-each-ref',
			'--format=%(refname)%00%(objectname)',
			'refs/notes/',
			'refs/heads/harness-evidence',
			'refs/harness/'
		]);
		const revision = (
			await gitRead(root, ['rev-parse', '--verify', '--end-of-options', `${input.commit}^{tree}`])
		).trim();
		const entries = new Map(
			refs
				.trim()
				.split('\n')
				.filter(Boolean)
				.map((line) => line.split('\0') as [string, string])
		);
		return {
			principalId: `local-filesystem:${process.getuid?.() ?? 'current'}`,
			projectId: this.session.projectId!,
			repositoryId: 0,
			requestedRef: input.commit,
			sourceCommit: input.commit,
			sourceTree: revision,
			notesRef: 'refs/notes/harness',
			notesRevision: entries.get('refs/notes/harness') ?? null,
			evidenceRef: 'refs/heads/harness-evidence',
			evidenceRevision: entries.get('refs/heads/harness-evidence') ?? null,
			historyIndexRevision: createHash('sha256').update(refs).digest('hex'),
			artifactHash: input.sha256,
			profile: null
		};
	}
}
