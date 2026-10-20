import { z } from 'zod';
import {
	actorSchema,
	anchorSchema,
	email,
	hash,
	id,
	label,
	repositorySchema
} from './parseCollaborationInput';
const time = z.iso.datetime();
const role = z.enum(['owner', 'writer', 'commenter', 'viewer']);
export const projectSchema = z.strictObject({
	id,
	name: label,
	sourceRepository: repositorySchema,
	createdAt: time,
	ownerId: label
});
const member = z.strictObject({ projectId: id, actorId: label, email, name: label, role });
const invitation = z.strictObject({
	id,
	projectId: id,
	expiresAt: time,
	codeHash: hash,
	email,
	role: z.enum(['writer', 'commenter', 'viewer']),
	acceptedBy: label.nullable()
});
const comment = z.strictObject({
	id,
	requestId: id,
	actor: actorSchema,
	text: z.string().trim().min(1).max(20000),
	createdAt: time
});
const thread = z.strictObject({
	id,
	projectId: id,
	anchor: anchorSchema,
	comments: z.array(comment).max(100000)
});
export const recordsSchema = z
	.strictObject({
		schemaVersion: z.literal(1),
		projects: z.array(projectSchema),
		members: z.array(member),
		invitations: z.array(invitation),
		threads: z.array(thread)
	})
	.superRefine((records, context) => {
		const unique = (values: string[]) => new Set(values).size === values.length;
		const projects = new Set(records.projects.map((p) => p.id));
		const valid =
			unique(records.projects.map((p) => p.id)) &&
			unique(records.members.map((m) => `${m.projectId}/${m.actorId}`)) &&
			unique(records.invitations.map((i) => i.id)) &&
			unique(records.threads.map((t) => t.id));
		if (!valid) context.addIssue({ code: 'custom', message: 'Duplicate record identity' });
		for (const record of [...records.members, ...records.invitations, ...records.threads]) {
			if (!projects.has(record.projectId))
				context.addIssue({ code: 'custom', message: 'Unbound record' });
		}
		for (const project of records.projects) {
			if (!records.members.some((m) => m.projectId === project.id && m.role === 'owner'))
				context.addIssue({ code: 'custom', message: 'Missing owner' });
		}
		const messages = records.threads.flatMap((t) =>
			t.comments.map((c) => `${t.projectId}/${c.requestId}`)
		);
		if (!unique(messages)) context.addIssue({ code: 'custom', message: 'Duplicate request' });
	});
