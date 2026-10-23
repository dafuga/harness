import type { Input, Project, Host } from './ui-project-fixture.types';
import type { Page } from '@playwright/test';
import { projectData, type ProjectData } from './ui-project-data';
export * from './ui-project-data';

function installState(data: ProjectData) {
	const calls: Input[] = [];
	const state = {
		data,
		selected: null as string | null,
		delay: {} as Record<string, number>,
		own,
		snapshot
	};
	function own(op: string, input: Input = {}) {
		calls.push({ op, ...input });
		const found = data.projects.find((item) => item.info.id === state.selected);
		if (!found || (input.projectId !== undefined && input.projectId !== state.selected))
			throw new Error('The requested project is not selected.');
		return found;
	}
	function snapshot(project: Project, commit: string | null = null) {
		return {
			project: { name: project.info.name, root: `/tmp/${project.info.name}`, id: project.info.id },
			...(project.askCapabilities ? {} : { capabilities: project.capabilities }),
			revision: {
				branch: project.branch,
				commit: commit || data.ids.tip,
				tip: data.ids.tip,
				atTip: !commit || commit === data.ids.tip
			},
			branches: [{ name: project.branch, tip: data.ids.tip, current: true }],
			commits: [
				{ hash: data.ids.tip, subject: 'Latest', authoredAt: '2026-10-11' },
				{ hash: data.ids.earlier, subject: 'Earlier', authoredAt: '2026-10-10' }
			],
			entities: project.entities,
			writable: !commit && project.info.kind !== 'shared'
		};
	}
	Object.assign(window, { __calls: calls, __projects: state });
}

function installReads() {
	const host = window as unknown as Host;
	const state = host.__projects;
	const wait = (op: string) => new Promise((done) => setTimeout(done, state.delay[op] ?? 0));
	host.harness = {
		listProjects: async () => state.data.projects.map((item) => item.info),
		selectProject: async (input: Input) => {
			host.__calls.push({ op: 'selectProject', ...input });
			const found = state.data.projects.find((item) => item.info.id === input.projectId);
			if (!found) throw new Error('Unknown project.');
			state.selected = found.info.id;
			return state.snapshot(found);
		},
		capabilities: async (input: Input) => state.own('capabilities', input).capabilities,
		snapshot: async (input: Input) => state.snapshot(state.own('snapshot', input), input.commit),
		entity: async (input: Input) => {
			const project = state.own('entity', input);
			const found = project.entities.find((item) => item.id === input.entityId);
			await wait('entity');
			if (!found) throw new Error('Unknown entity.');
			return found;
		},
		image: async (input: Input) => {
			state.own('image', input);
			return new Uint8Array(state.data.image);
		},
		source: async (input: Input) => ({
			path: String(input.path),
			text: state.own('source', input).branch
		}),
		messages: async (input: Input) =>
			state.own('messages', input).messages[String(input.threadId)] ?? [],
		providers: async () => {
			host.__calls.push({ op: 'providers' });
			return state.data.providers;
		},
		onRunEvent: () => () => {}
	};
}

function installWrites() {
	const host = window as unknown as Host;
	const state = host.__projects;
	const refuse = (op: string) => async (input: Input) => {
		state.own(op, input);
		throw new Error(`${op} is not part of this fixture.`);
	};
	Object.assign(host.harness, {
		openProject: async () => null,
		createPlan: refuse('createPlan'),
		approve: refuse('approve'),
		startRun: refuse('startRun'),
		cancelRun: refuse('cancelRun'),
		openThread: async (input: Input) => {
			const page = state.own('openThread', input).entities[0];
			const { projectId: _projectId, entityId: _entityId, ...anchor } = input;
			const thread = { ...anchor, id: state.data.ids.openedThread, pin: 2, messageCount: 0 };
			page.threads.push(thread);
			return thread;
		}
	});
}

/** A local project keeps a comment as a pending draft; a shared one answers with its commit. */
function installComments() {
	const host = window as unknown as Host;
	const state = host.__projects;
	const shared = (project: Project, input: Input) => {
		const id = String(input.threadId ?? state.data.ids.gammaThread);
		const anchor = input.anchor as Record<string, unknown>;
		const comment = { id: `comment-${Date.now()}`, at: 'Now', author: 'user', text: input.text };
		const said = {
			...comment,
			authorName: 'Ada Example',
			mode: null,
			provider: null,
			version: null
		};
		const page = project.entities[0];
		if (!page.threads.some((item) => item.id === id))
			page.threads.push({ ...anchor, id, pin: page.threads.length + 1, messageCount: 1 });
		(project.messages[id] ??= []).push(said);
		const actor = { id: 'google:1', email: 'ada@example.invalid', name: 'Ada Example' };
		const comments = [{ id: comment.id, requestId: input.requestId, actor, text: input.text }];
		const thread = { id, projectId: project.info.id, anchor, comments };
		return {
			kind: 'shared',
			projectId: project.info.id,
			thread: { ...thread, collaborationCommit: state.data.ids.sharedCommit }
		};
	};
	Object.assign(host.harness, {
		addComment: async (input: Input) => {
			const project = state.own('addComment', input);
			if (project.info.kind === 'shared') return shared(project, input);
			const saved = await host.__outbox('save', { projectId: project.info.id, input });
			return saved.at(-1);
		},
		pendingComments: async (input: Input) => {
			const id = state.own('pendingComments', input).info.id;
			return (await host.__outbox('list')).filter((item) => item.projectId === id);
		}
	});
}

/**
 * A bridge like the Electron one: projects are selected in the main process, which outlives a
 * reload. The outbox lives in the test process, so it survives a reload and cleared page storage.
 */
export async function projectFixture(page: Page) {
	const outbox: Record<string, unknown>[] = [];
	await page.exposeFunction('__outbox', (op: string, value?: Record<string, unknown>) => {
		if (op === 'save')
			outbox.push({
				kind: 'pending',
				draftId: `draft-${outbox.length + 1}`,
				savedAt: '2026-10-12T00:00:00.000Z',
				reason: 'Saved locally; not synced. Connect a verified shared project to publish.',
				...value
			});
		return outbox;
	});
	await page.addInitScript(installState, projectData());
	await page.addInitScript(installReads);
	await page.addInitScript(installWrites);
	await page.addInitScript(installComments);
	return outbox;
}
