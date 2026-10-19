import { z } from 'zod';
import type {
	CollaborationApi,
	CollaborationDependencies
} from '../../models/Collaboration.types.ts';
import { actorSchema, entityId, id, parse, sha } from '../parseCollaborationInput';
import { currentProject } from '../currentProject';
import { readRecords } from './currentProject';
import { recordsSchema } from '../recordsSchema';
import { createInvitation, acceptInvitation } from './createInvitation';
import { createProject, removeMember } from './createProject';
import { addComment } from './addComment';

export function createCollaboration(deps: CollaborationDependencies): CollaborationApi {
	return {
		async listProjects(actor) {
			parse(actorSchema, actor);
			const records = await readRecords(deps);
			return records.projects
				.filter((p) => records.members.some((m) => m.projectId === p.id && m.actorId === actor.id))
				.map((p) => currentProject(records, actor, p.id));
		},
		createProject: (actor, input) => createProject(deps, actor, input),
		async getProject(actor, projectId) {
			const snapshot = await deps.repository.read();
			const records = parse(recordsSchema, snapshot.records);
			return {
				...currentProject(records, actor, projectId),
				collaborationCommit: snapshot.revision
			};
		},
		async listMembers(actor, projectId) {
			const records = await readRecords(deps);
			currentProject(records, actor, projectId, ['owner']);
			return records.members.filter((m) => m.projectId === projectId);
		},
		removeMember: (actor, input) => removeMember(deps, actor, input),
		createInvitation: (actor, input) => createInvitation(deps, actor, input),
		acceptInvitation: (actor, input) => acceptInvitation(deps, actor, input),
		addComment: (actor, input) => addComment(deps, actor, input),
		async listThreads(actor, input) {
			const value = parse(z.strictObject({ projectId: id, entityId, commit: sha }), input);
			const snapshot = await deps.repository.read();
			const records = parse(recordsSchema, snapshot.records);
			currentProject(records, actor, value.projectId);
			return records.threads
				.filter(
					(t) =>
						t.projectId === value.projectId &&
						t.anchor.entityId === value.entityId &&
						t.anchor.commit === value.commit
				)
				.map((t) => ({ ...t, collaborationCommit: snapshot.revision }));
		}
	};
}
