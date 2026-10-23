import type { ClientProject, ClientProjectsOptions } from './ClientProjectsService.types';
import { desktopBridge } from '../../../../lib/development-tooling/desktop-bridge/desktopBridge';
import { DesktopRunService } from '../../../agents-providers/desktop-run-service/DesktopRunService';
import { ProjectSessionService } from '../../../projects-sessions/project-session-service/ProjectSessionService';

const ended = 'This session has ended.';

/**
 * The projects one client has open, each with its own session, revision and runs. Nothing here
 * is shared with another client except the registry, the outbox and the repository arbiter.
 */
export class ClientProjectsService {
	private readonly opening = new Map<string, Promise<ClientProject>>();
	private readonly ready = new Map<string, ClientProject>();
	private over = false;
	constructor(private readonly options: ClientProjectsOptions) {}
	get roots(): string[] {
		return [...this.ready.values()].map((project) => project.root);
	}
	/** Opens a registered project once for this client; concurrent requests share the opening. */
	use(projectId: string): Promise<ClientProject> {
		if (this.over) return Promise.reject(new Error(ended));
		const known = this.opening.get(projectId);
		if (known) return known;
		const opening = this.open(projectId);
		this.opening.set(projectId, opening);
		opening.catch(() => this.opening.delete(projectId));
		return opening;
	}
	/** True once the client was revoked or shut down. Nothing is written for it afterwards. */
	get ended(): boolean {
		return this.over;
	}
	/** Every run of this client is cancelled, and a write that is still on its way is refused. */
	end(): void {
		this.over = true;
		for (const project of this.ready.values()) project.runs.cancelActive();
	}
	private async open(projectId: string): Promise<ClientProject> {
		const { registry, outbox, arbiter, cache, providers, generator, emit } = this.options;
		const record = await registry.get(projectId);
		const session = new ProjectSessionService({ registry, outbox, arbiter, cache });
		await session.open(record.root ?? '');
		/*
		 * Opening reads Git and the planning files and cannot be aborted; it is short. When the
		 * client ended meanwhile, what was opened is dropped here: no run service, no bridge, no
		 * entry. A write could not have happened, since nothing was handed out.
		 */
		if (this.over) throw new Error(ended);
		const runs = new DesktopRunService(session, providers, generator, emit);
		const alive = () => !this.over,
			bridge = desktopBridge({ session, providers, runs, choose: async () => null, alive });
		const project = { id: projectId, root: session.root ?? '', session, runs, bridge };
		this.ready.set(projectId, project);
		return project;
	}
}

export type { ClientProjectsOptions, ClientProject } from './ClientProjectsService.types';
