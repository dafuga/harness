import { z } from "zod";
import type { Actor, CollaborationApi, CollaborationDependencies } from "../../models/Collaboration.types.ts";
import { actorSchema, id, label, parse, repositorySchema, fail } from "../parseCollaborationInput";
import { currentProject, now, transaction } from "../currentProject";

async function authorizedRepository(
	deps: CollaborationDependencies,
	actor: Actor,
	repositoryId: number
) {
	try {
		const repository = parse(repositorySchema, await deps.authorizeRepository(actor, repositoryId));
		if (repository.id !== repositoryId) return fail('forbidden');
		return repository;
	} catch {
		return fail('forbidden');
	}
}

export async function createProject(
	deps: CollaborationDependencies,
	actor: Actor,
	input: Parameters<CollaborationApi['createProject']>[1]
) {
	const verified = parse(actorSchema, actor);
	const value = parse(
		z.strictObject({ name: label, repositoryId: z.number().int().positive() }),
		input
	);
	const projectId = crypto.randomUUID();
	const result = await transaction(deps, async (records) => {
		const sourceRepository = await authorizedRepository(deps, verified, value.repositoryId);
		const project = {
			id: projectId,
			name: value.name,
			sourceRepository,
			createdAt: now(deps).toISOString(),
			ownerId: verified.id
		};
		records.projects.push(project);
		records.members.push({
			projectId,
			actorId: verified.id,
			email: verified.email,
			name: verified.name,
			role: 'owner'
		});
		return { ...project, role: 'owner' as const };
	});
	return { ...result.value, collaborationCommit: result.revision };
}

export async function removeMember(
	deps: CollaborationDependencies,
	actor: Actor,
	input: Parameters<CollaborationApi['removeMember']>[1]
) {
	const value = parse(z.strictObject({ projectId: id, memberId: label }), input);
	await transaction(deps, async (records) => {
		currentProject(records, actor, value.projectId, ['owner']);
		const target = records.members.find(
			(m) => m.projectId === value.projectId && m.actorId === value.memberId
		);
		if (!target) return fail('not-found');
		if (
			target.role === 'owner' &&
			records.members.filter((m) => m.projectId === value.projectId && m.role === 'owner').length <=
				1
		)
			return fail('sole-owner');
		records.members = records.members.filter((m) => m !== target);
		records.invitations = records.invitations.filter(
			(i) => i.projectId !== value.projectId || i.email !== target.email
		);
	});
}
