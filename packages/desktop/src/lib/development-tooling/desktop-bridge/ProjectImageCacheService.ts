import { createHash } from 'node:crypto';
import type { CacheIdentity } from '../../../../../collaboration/src/models/Collaboration.types';
import type { ImageQuery } from '../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import { gitRead } from '../../../utils/projects-sessions/gitRead';
function refEntries(refs: string): Map<string, string> {
	return new Map(
		refs
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => line.split('\0') as [string, string])
	);
}
/** Revalidates the project and exact design before consulting disposable bytes. */
export class ProjectImageCacheService {
	constructor(private session: ProjectSessionService) {}
	async read(input: ImageQuery): Promise<Uint8Array> {
		this.session.assertProject(input.projectId);
		const project = this.session.requireProject();
		const projectId = this.session.projectId;
		if (!projectId) throw new Error('No project selected.');
		const entity = await project.catalog.entity(input.entityId, input.commit);
		this.assertSession(projectId, project);
		const image = entity.versions
			.find((version) => version.version === input.version)
			?.images.find(
				(image) =>
					image.sha256 === input.sha256 &&
					(input.option === undefined || image.option === input.option)
			);
		if (!image) throw new Error('Unknown project image.');
		const identity = await this.identity(input, { root: project.root, projectId });
		this.assertSession(projectId, project);
		const cached = await this.session.cache?.get(identity, input.sha256);
		this.assertSession(projectId, project);
		if (cached && cached.length === image.bytes) return cached;
		const bytes = await project.planning.image({ ...input, revision: input.commit });
		this.assertSession(projectId, project);
		if (
			bytes.length !== image.bytes ||
			createHash('sha256').update(bytes).digest('hex') !== input.sha256
		)
			throw new Error('Image hash mismatch.');
		await this.session.cache?.put(identity, bytes, input.sha256);
		this.assertSession(projectId, project);
		return bytes;
	}
	private assertSession(
		projectId: string,
		project: ReturnType<ProjectSessionService['requireProject']>
	) {
		this.session.assertProject(projectId);
		const current = this.session.requireProject();
		if (
			current.root !== project.root ||
			current.source !== project.source ||
			current.catalog !== project.catalog ||
			current.planning !== project.planning
		)
			throw new Error('Project session changed during image read.');
	}
	private async identity(
		input: ImageQuery,
		{ root, projectId }: { root: string; projectId: string }
	): Promise<CacheIdentity> {
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
		const entries = refEntries(refs);
		return {
			principalId: `local-filesystem:${process.getuid?.() ?? 'current'}`,
			projectId,
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
