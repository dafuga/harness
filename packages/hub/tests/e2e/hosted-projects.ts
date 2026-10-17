import { code, image, invitation, sharedCommit, tip, earlier } from './hosted-data';
import type { HostedProject } from './hosted-data';
import type { Answer, HostedCall, HostedState } from './hosted-fixture';
import { hostedEvidence } from './hosted-evidence';

const denied = ['runs', 'plans', 'approve', 'changes'];
const missing: Answer = { status: 404, json: { error: 'not-found' } };

function snapshot(project: HostedProject, call: HostedCall): Answer {
	if (call.query.branch && call.query.branch !== project.branch) return missing;
	const commit = call.query.commit || tip;
	const { id, name, role, branch, entity } = project;
	return {
		json: {
			project: { id, name, root: '' },
			revision: { branch, commit, tip, atTip: commit === tip },
			branches: [{ name: branch, tip, current: true }],
			commits: [
				{ hash: tip, subject: 'Latest', authoredAt: '2026-10-11' },
				{ hash: earlier, subject: 'Earlier', authoredAt: '2026-10-10' }
			],
			entities: [entity],
			writable: false,
			capabilities: {
				comments: role !== 'viewer',
				agents: false,
				planning: false,
				approval: false,
				source: 'github'
			}
		}
	};
}

function pins(threads: Record<string, unknown>[]) {
	return threads.map((thread, index) => {
		const {
			branch: _b,
			commit: _c,
			entityId: _e,
			...where
		} = thread.anchor as Record<string, unknown>;
		return { ...where, id: thread.id, pin: index + 1, messageCount: 1 };
	});
}

function comment(state: HostedState, project: HostedProject, call: HostedCall): Answer {
	if (project.role === 'viewer') return { status: 403, json: { error: 'forbidden' } };
	const threads = state.data.threads[project.id];
	const body = call.body ?? {};
	const id = String(body.threadId ?? '44444444-4444-4444-8444-444444444444');
	let thread = threads.find((item) => item.id === id);
	if (!thread) {
		thread = { id, projectId: project.id, anchor: body.anchor, comments: [] };
		threads.push(thread);
	}
	(thread.comments as unknown[]).push({
		id: `comment-${threads.length}-${(thread.comments as unknown[]).length}`,
		requestId: body.requestId,
		actor: {
			id: 'google:ada',
			email: 'ada@example.invalid',
			name: 'Ada Example',
			emailVerified: true
		},
		text: body.text,
		createdAt: '2026-10-12T10:00:00.000Z'
	});
	return { status: 201, json: { ...thread, collaborationCommit: sharedCommit } };
}

function write(state: HostedState, project: HostedProject, call: HostedCall): Answer {
	const [operation, , action] = call.path.split('/').slice(4);
	if (denied.includes(operation))
		return { status: 403, json: { error: 'hosted-execution-denied' } };
	if (operation === 'comments') return comment(state, project, call);
	if (operation !== 'invitations') return { status: 405, json: { error: 'method-denied' } };
	if (action === 'accept')
		return call.body?.code === code
			? { json: project }
			: { status: 400, json: { error: 'invitation-invalid' } };
	const expiresAt = '2026-10-19T00:00:00.000Z';
	return { status: 201, json: { id: invitation, projectId: project.id, expiresAt, code } };
}

function read(state: HostedState, project: HostedProject, call: HostedCall): Answer {
	const operation = call.path.split('/')[4] ?? '';
	const threads = state.data.threads[project.id];
	if (!operation) return { json: project };
	if (operation === 'members')
		return { json: state.data.members.filter((item) => item.projectId === project.id) };
	if (operation === 'snapshot') return snapshot(project, call);
	if (operation === 'evidence') return { json: hostedEvidence(project, call) };
	if (operation === 'image') return { bytes: image };
	if (operation === 'threads') return { json: threads };
	if (operation === 'source') return { json: { path: call.query.path, text: project.name } };
	if (operation !== 'entity' || call.query.entityId !== project.entity.id) return missing;
	return { json: { ...project.entity, threads: pins(threads), threadCount: threads.length } };
}

export function projectAnswer(state: HostedState, call: HostedCall): Answer {
	if (!state.signedIn) return { status: 401, json: { error: 'session-required' } };
	const projects = state.empty ? [] : state.data.projects;
	const id = call.path.split('/')[3];
	if (!id && call.method === 'GET') return { json: projects };
	if (!id) {
		const created = { ...state.data.projects[0], ...call.body, id: invitation, role: 'owner' };
		return { status: 201, json: created };
	}
	const project = projects.find((item) => item.id === id);
	if (!project) return missing;
	return call.method === 'GET' ? read(state, project, call) : write(state, project, call);
}
