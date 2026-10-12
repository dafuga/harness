import type { DesktopBridge } from '../models/DesktopBridge.types';
import type { ProjectSessionService } from './ProjectSessionService';
import type { RemoteProjectPort, HumanCommentDraft } from '../models/ProjectContext.types';
type Bridge = Omit<DesktopBridge, 'onRunEvent'>;
export class HostedProjectService {
	private selected: string | null = null;
	constructor(
		private session: ProjectSessionService,
		private remote: RemoteProjectPort
	) {}
	wrap(local: Bridge): Bridge {
		return new Proxy(local, {
			get: (target, key: keyof Bridge) => {
				if (key === 'listProjects')
					return async () => [
						...(await local.listProjects!()),
						...((await this.remote.available?.()) === false ? [] : await this.remote.listProjects())
					];
				if (key === 'selectProject')
					return (input: { projectId: string }) => this.select(local, input.projectId);
				if (key === 'openProject')
					return async () => {
						const result = await local.openProject();
						if (result) this.selected = null;
						return result;
					};
				if (['hostedStatus', 'connectHosted', 'disconnectHosted'].includes(key) || !this.selected)
					return target[key];
				return (input: Record<string, unknown> = {}) => this.dispatch(key, input);
			}
		});
	}
	private async select(local: Bridge, projectId: string) {
		if (this.session.busy || this.session.pending)
			throw new Error('Wait for the active project operation.');
		if (projectId.startsWith('local-')) {
			const snapshot = await local.selectProject!({ projectId });
			this.selected = null;
			return snapshot;
		}
		this.session.pending++;
		try {
			const snapshot = await this.remote.snapshot({ projectId, branch: null, commit: null });
			this.selected = projectId;
			return snapshot;
		} finally {
			this.session.pending--;
		}
	}
	private async dispatch(key: keyof Bridge, input: Record<string, unknown>) {
		const projectId = this.selected!;
		if (input.projectId !== undefined && input.projectId !== projectId)
			throw new Error('The requested project is not selected.');
		this.session.pending++;
		try {
			return await this.read(key, { ...input, projectId });
		} finally {
			this.session.pending--;
		}
	}
	private async read(
		key: keyof Bridge,
		input: Record<string, unknown> & { projectId: string }
	): Promise<unknown> {
		if (key === 'providers') return [];
		if (key === 'capabilities') return this.remote.capabilities(input.projectId);
		if (key === 'pendingComments') return [];
		if (key === 'addComment') {
			const thread = await this.remote.addComment(
				input as unknown as HumanCommentDraft & { projectId: string }
			);
			return { kind: 'shared', projectId: input.projectId, thread };
		}
		const methods = ['snapshot', 'entity', 'source', 'image', 'messages', 'history'] as const;
		if (!(methods as readonly string[]).includes(key))
			throw new Error('Agent runs and source mutations are unavailable in shared projects.');
		const method = this.remote[key as (typeof methods)[number]] as (
			input: unknown
		) => Promise<unknown>;
		if (!method) throw new Error('Desktop operation unavailable.');
		return method.call(this.remote, input);
	}
}
