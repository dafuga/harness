import { z } from 'zod';
import type {
	Actor,
	CollaborationDependencies,
	CollaborationApi
} from '../models/Collaboration.types';
import { actorSchema, digest, email, fail, id, parse } from './parseCollaborationInput';
import { currentProject, now, transaction } from './currentProject';
export async function createInvitation(
	deps: CollaborationDependencies,
	actor: Actor,
	input: Parameters<CollaborationApi['createInvitation']>[1]
) {
	const value = parse(
		z.strictObject({ projectId: id, email, role: z.enum(['writer', 'commenter', 'viewer']) }),
		input
	);
	parse(actorSchema, actor);
	const code = [...crypto.getRandomValues(new Uint8Array(32))]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const invitation = {
		id: crypto.randomUUID(),
		projectId: value.projectId,
		expiresAt: new Date(now(deps).getTime() + 86400000).toISOString(),
		codeHash: await digest(new TextEncoder().encode(code)),
		email: value.email,
		role: value.role,
		acceptedBy: null
	};
	await transaction(deps, async (records) => {
		currentProject(records, actor, value.projectId, ['owner']);
		records.invitations.push(invitation);
	});
	return {
		id: invitation.id,
		projectId: invitation.projectId,
		expiresAt: invitation.expiresAt,
		code
	};
}
export async function acceptInvitation(
	deps: CollaborationDependencies,
	actor: Actor,
	input: Parameters<CollaborationApi['acceptInvitation']>[1]
) {
	const value = parse(
		z.strictObject({ projectId: id, invitationId: id, code: z.string().regex(/^[a-f0-9]{64}$/) }),
		input
	);
	const verified = parse(actorSchema, actor);
	const codeHash = await digest(new TextEncoder().encode(value.code));
	const result = await transaction(deps, async (records) => {
		const invitation = records.invitations.find(
			(i) => i.id === value.invitationId && i.projectId === value.projectId
		);
		if (
			!invitation ||
			invitation.acceptedBy ||
			invitation.codeHash !== codeHash ||
			invitation.email !== verified.email ||
			Date.parse(invitation.expiresAt) <= now(deps).getTime()
		)
			return fail('invalid-invitation');
		if (!records.projects.some((p) => p.id === value.projectId)) return fail('invalid-invitation');
		const existing = records.members.find(
			(m) => m.projectId === value.projectId && m.actorId === verified.id
		);
		if (!existing)
			records.members.push({
				projectId: value.projectId,
				actorId: verified.id,
				email: verified.email,
				name: verified.name,
				role: invitation.role
			});
		invitation.acceptedBy = verified.id;
		return currentProject(records, verified, value.projectId);
	});
	return result.value;
}
