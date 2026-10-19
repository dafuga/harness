import type {
	Actor,
	CollaborationDependencies,
	CollaborationRecords,
	ProjectSummary,
	Role
} from '../models/Collaboration.types';
import { fail, parse, actorSchema, id } from './parseCollaborationInput';
import { recordsSchema } from './recordsSchema';

export function currentProject(
	records: CollaborationRecords,
	actor: Actor,
	projectId: string,
	roles: Role[] = ['owner', 'writer', 'commenter', 'viewer']
): ProjectSummary {
	parse(actorSchema, actor);
	parse(id, projectId);
	const project = records.projects.find((p) => p.id === projectId);
	const member = records.members.find((m) => m.projectId === projectId && m.actorId === actor.id);
	if (!project || !member || !roles.includes(member.role)) return fail('forbidden');
	return { ...project, role: member.role };
}

export async function transaction<T>(
	deps: CollaborationDependencies,
	operation: (records: CollaborationRecords) => Promise<T>
): Promise<{ value: T; revision: string }> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const snapshot = await deps.repository.read();
		const records = parse(recordsSchema, snapshot.records);
		const before = JSON.stringify(records);
		const value = await operation(records);
		if (JSON.stringify(records) === before) return { value, revision: snapshot.revision };
		const revision = await deps.repository.compareAndSwap(
			snapshot.revision,
			parse(recordsSchema, records)
		);
		if (revision) return { value, revision };
	}
	return fail('conflict');
}

export function now(deps: CollaborationDependencies): Date {
	return deps.now?.() ?? new Date();
}

export { readRecords } from './create-collaboration/readRecords';
