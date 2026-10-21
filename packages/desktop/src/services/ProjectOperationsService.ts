import type { ProjectSessionService } from './ProjectSessionService';
import type {
	HumanCommentDraft,
	ProjectCapabilities,
	ProjectContext
} from '../models/ProjectContext.types';
export class ProjectOperationsService {
	constructor(
		private session: ProjectSessionService,
		private outbox = session.outbox
	) {}
	listProjects() {
		return this.session.registry.list();
	}
	async selectProject(input: { projectId: string }) {
		if (input.projectId === this.session.projectId && !this.session.selecting)
			return this.session.snapshot({ projectId: input.projectId, branch: null, commit: null });
		const project = await this.session.registry.get(input.projectId);
		return this.session.open(project.root!);
	}
	async capabilities(input: ProjectContext = {}): Promise<ProjectCapabilities> {
		this.session.assertProject(input.projectId);
		this.session.requireProject();
		return {
			comments: true,
			agents: true,
			planning: true,
			approval: true,
			source: 'local',
			reason: 'Human comments are local pending drafts, not synced.'
		};
	}
	async addComment(input: HumanCommentDraft) {
		this.session.assertProject(input.projectId);
		const project = this.session.requireProject();
		const revision = await project.source.revision({
			branch: input.anchor.branch,
			commit: input.anchor.commit
		});
		if (projectDiscussion(input))
			return this.outbox.save({ ...input, projectId: this.session.projectId! });
		const entity = await project.catalog.entity(input.anchor.entityId, revision.commit);
		if (input.anchor.imageSha256) {
			const image = entity.versions
				.find((version) => version.version === input.anchor.version)
				?.images.find(
					(image) =>
						image.sha256 === input.anchor.imageSha256 &&
						image.state === input.anchor.state &&
						image.viewport === input.anchor.viewport
				);
			if (!image) throw new Error('Unknown comment image anchor.');
		}
		if (
			input.threadId &&
			!entity.threads.some(
				(thread) =>
					thread.id === input.threadId &&
					thread.imageSha256 === input.anchor.imageSha256 &&
					thread.version === input.anchor.version
			)
		)
			throw new Error('Unknown comment thread.');
		return this.outbox.save({ ...input, projectId: this.session.projectId! });
	}
	async pendingComments(input: ProjectContext = {}) {
		this.session.assertProject(input.projectId);
		this.session.requireProject();
		return this.outbox.list(this.session.projectId!);
	}
}

function projectDiscussion(input: HumanCommentDraft): boolean {
	if (input.anchor.entityId !== 'harness.project.discussion') return false;
	if (
		input.threadId ||
		input.anchor.version ||
		input.anchor.imageSha256 ||
		input.anchor.state ||
		input.anchor.viewport ||
		input.anchor.region
	)
		throw new Error('Invalid project discussion anchor.');
	return true;
}
