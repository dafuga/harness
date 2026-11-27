// @harness-uid u_h3qimurn22
import type { Bridge, HostedInput } from './HostedProjectService.types';
import { HostedProjectBusyError } from './HostedProjectBusyError';
import { HostedProjectEvidenceUnavailableError } from './HostedProjectEvidenceUnavailableError';
import { HostedProjectExecutorUnavailableError } from './HostedProjectExecutorUnavailableError';
import { HostedProjectNotSelectedError } from './HostedProjectNotSelectedError';
import { HostedProjectOperationUnsupportedError } from './HostedProjectOperationUnsupportedError';
import { HostedProjectReadUnavailableError } from './HostedProjectReadUnavailableError';
import type { ProjectSessionService } from '../../projects-sessions/project-session-service/ProjectSessionService';
import type {
	RemoteProjectPort,
	HumanCommentDraft,
	CacheStatus
} from '../../../models/projects-sessions/ProjectContext.types';
/** A shared project dispatches only the reads its hosted port offers. */
const unread = 'Recorded evidence of a shared project is not read on this computer yet.';
export class HostedProjectService {
	private selected: string | null = null;
	constructor(
		private session: ProjectSessionService,
		private remote: RemoteProjectPort,
		private onCacheStatus?: (event: CacheStatus) => void
	) {}
	wrap(local: Bridge): Bridge {
		return new Proxy(local, {
			get: (target, key: keyof Bridge) => {
				if (key === 'listProjects') return () => this.listProjects(local);
				if (key === 'selectProject')
					return (input: { projectId: string }) => this.select(local, input.projectId);
				if (key === 'gameCreate') return target[key];
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
	private async listProjects(local: Bridge) {
		const hosted = async () =>
			(await this.remote.available?.()) === false ? [] : this.remote.listProjects();
		const [device, hub] = await Promise.allSettled([
			Promise.resolve().then(() => local.listProjects!()),
			hosted()
		]);
		// The remote reader reports fresh, cached and denied results under its own authority.
		if (hub.status === 'rejected')
			this.onCacheStatus?.({ projectId: '$projects', status: 'unavailable' });
		this.onCacheStatus?.({
			projectId: '$local-projects',
			status: device.status === 'fulfilled' ? 'fresh' : 'unavailable'
		});
		return [
			...(device.status === 'fulfilled' ? device.value : []),
			...(hub.status === 'fulfilled' ? hub.value : [])
		];
	}
	private async select(local: Bridge, projectId: string) {
		// The local project already open is read again; any switch waits for active work.
		const reread = this.selected === null && projectId === this.session.projectId;
		if (!reread && (this.session.busy || this.session.pending))
			throw new HostedProjectBusyError('Wait for the active project operation.');
		if (projectId.startsWith('local-')) {
			const snapshot = await local.selectProject!({ projectId });
			this.selected = null;
			return snapshot;
		}
		this.session.pending++;
		try {
			const snapshot = await this.remote.snapshot({
				projectId,
				branch: null,
				commit: null
			});
			this.selected = projectId;
			return snapshot;
		} finally {
			this.session.pending--;
		}
	}
	private async dispatch(key: keyof Bridge, input: Record<string, unknown>) {
		const projectId = this.selected!;
		if (input.projectId !== undefined && input.projectId !== projectId)
			throw new HostedProjectNotSelectedError('The requested project is not selected.');
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
		if (['providers', 'startRun', 'cancelRun', 'openThread', 'approve'].includes(key))
			return agent(this.remote, key, input);
		if (key === 'capabilities') return this.remote.capabilities(input.projectId);
		if (key === 'pendingComments') return [];
		if (key === 'addComment') {
			const thread = await this.remote.addComment(
				input as unknown as HumanCommentDraft & { projectId: string }
			);
			return { kind: 'shared', projectId: input.projectId, thread };
		}
		return readOperation(this.remote, key, input);
	}
}
function agent(remote: RemoteProjectPort, key: keyof Bridge, input: HostedInput) {
	if (remote.agent) return remote.agent(key, input, input.projectId);
	if (key === 'providers') return [];
	throw new HostedProjectExecutorUnavailableError(
		'Agent runs and source mutations are unavailable in shared projects without a connected executor.'
	);
}
function readOperation(remote: RemoteProjectPort, key: keyof Bridge, input: HostedInput) {
	if (['evidence', 'artifact'].includes(key) && !remote[key as 'evidence' | 'artifact'])
		throw new HostedProjectEvidenceUnavailableError(unread);
	const methods = [
		'snapshot',
		'entity',
		'source',
		'image',
		'messages',
		'history',
		'evidence',
		'artifact'
	] as const;
	if (!(methods as readonly string[]).includes(key))
		throw new HostedProjectOperationUnsupportedError(
			'Agent runs and source mutations are unavailable in shared projects.'
		);
	const method = remote[key as (typeof methods)[number]] as (input: unknown) => Promise<unknown>;
	if (!method) throw new HostedProjectReadUnavailableError('Desktop operation unavailable.');
	return method.call(remote, input);
}
