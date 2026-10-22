import type {
	DesktopBridge,
	RunEvent
} from '../../../models/development-tooling/DesktopBridge.types';
import type { DesktopProject } from '../../../models/projects-sessions/ProjectContext.types';

export interface CapacitorProjectsServiceConfig {
	/** This phone's own Hub account: the projects it owns or was invited to. */
	cloud: DesktopBridge;
	/** The paired computer. What it offers follows its status, so it is read at every use. */
	mac: DesktopBridge;
}

type Key = keyof DesktopBridge;

type Input = { projectId?: string; runId?: string };

type Operation = (input?: Input) => Promise<unknown>;

/** Operations a bridge may lack: found while the authority of the selected project offers them. */
const optional = [
	'selectProject',
	'capabilities',
	'addComment',
	'pendingComments',
	'history',
	'evidence',
	'artifact'
] as const;

const unavailable = 'This operation is not available for this project on this phone.';

/** A computer's projects are `local-…`; every other project is one of the Hub account's. */
function local(projectId: string | null | undefined): boolean {
	return Boolean(projectId?.startsWith('local-'));
}

function cancelledRun(key: Key, input?: Input): string | undefined {
	return key === 'cancelRun' ? input?.runId : undefined;
}

function both(...releases: Array<(() => void) | undefined>): () => void {
	return () => releases.forEach((release) => release?.());
}

/**
 * The phone's product interface: its own Hub account beside the paired computer. Both lists are
 * shown together; each operation goes to the authority of its project only, and what one of them
 * refuses is never asked of the other. Without a computer the account works alone.
 */
export class CapacitorProjectsService {
	private selected: string | null = null;
	/** Where each run was started, so that it is cancelled there. */
	private readonly runs = new Map<string, DesktopBridge>();
	constructor(private readonly config: CapacitorProjectsServiceConfig) {}

	connect(): DesktopBridge {
		const { cloud, mac } = this.config;
		const bridge: DesktopBridge = {
			hostedStatus: () => cloud.hostedStatus!(),
			connectHosted: () => cloud.connectHosted!(),
			disconnectHosted: () => cloud.disconnectHosted!(),
			listProjects: () => this.list(),
			openProject: () => mac.openProject(),
			onRunEvent: (listener) => this.listen(listener),
			onCacheStatus: (listener) =>
				both(cloud.onCacheStatus?.(listener), mac.onCacheStatus?.(listener)),
			snapshot: this.routed('snapshot'),
			entity: this.routed('entity'),
			source: this.routed('source'),
			image: this.routed('image'),
			createPlan: this.routed('createPlan'),
			openThread: this.routed('openThread'),
			messages: this.routed('messages'),
			approve: this.routed('approve'),
			providers: this.routed('providers'),
			startRun: this.routed('startRun'),
			cancelRun: this.routed('cancelRun')
		};
		return Object.defineProperties(bridge, this.offered());
	}

	private listen(listener: (event: RunEvent) => void): () => void {
		const seen = (event: RunEvent) => {
			if (['finished', 'failed', 'cancelled'].includes(event.kind)) this.runs.delete(event.runId);
			listener(event);
		};
		return both(this.config.cloud.onRunEvent(seen), this.config.mac.onRunEvent(seen));
	}

	/** Both lists, each holding its own kind of project only; one that fails leaves the other. */
	private async list(): Promise<DesktopProject[]> {
		const { cloud, mac } = this.config;
		const sides = [cloud, mac].filter((side) => side.listProjects);
		const answers = await Promise.allSettled(sides.map((side) => side.listProjects!()));
		const failed = answers.find(
			(item): item is PromiseRejectedResult => item.status === 'rejected'
		);
		if (failed && answers.every((item) => item.status === 'rejected')) throw failed.reason;
		const listed = new Map<string, DesktopProject>();
		answers.forEach((answer, index) => {
			if (answer.status === 'rejected') return;
			const own = (project: DesktopProject) => local(project.id) === (sides[index] === mac);
			for (const project of answer.value.filter(own))
				if (!listed.has(project.id)) listed.set(project.id, project);
		});
		return [...listed.values()];
	}

	/** Found only while the authority of the selected project offers them; selecting, while either does. */
	private offered(): PropertyDescriptorMap {
		const descriptor = (key: (typeof optional)[number]) => ({
			enumerable: true,
			get: () => (this.offers(key) ? this.routed(key) : undefined)
		});
		return Object.fromEntries(optional.map((key) => [key, descriptor(key)]));
	}

	private offers(key: Key): boolean {
		const { cloud, mac } = this.config;
		if (key === 'selectProject' || this.selected === null) return Boolean(cloud[key] ?? mac[key]);
		return Boolean((local(this.selected) ? mac : cloud)[key]);
	}

	private routed<K extends Key>(key: K): NonNullable<DesktopBridge[K]> {
		const operation = (input?: Input) => this.route(key, input);
		return operation as unknown as NonNullable<DesktopBridge[K]>;
	}

	/** One operation at the authority of its project, and nowhere else, also when it fails there. */
	private async route(key: Key, input?: Input): Promise<unknown> {
		const side = this.side(key, input);
		const operation = side[key] as unknown as Operation | undefined;
		if (typeof operation !== 'function')
			throw Object.assign(new Error(unavailable), { code: 'method-denied' });
		const answer = await operation(input);
		const named = key === 'snapshot' || key === 'selectProject';
		if (named && input?.projectId) this.selected = input.projectId;
		const runId = key === 'startRun' ? (answer as { runId?: unknown } | null)?.runId : undefined;
		if (typeof runId === 'string') this.runs.set(runId, side);
		const cancelled = cancelledRun(key, input);
		if (cancelled) this.runs.delete(cancelled);
		return answer;
	}

	private side(key: Key, input?: Input): DesktopBridge {
		const run = key === 'cancelRun' && input?.runId ? this.runs.get(input.runId) : undefined;
		if (run) return run;
		return local(input?.projectId ?? this.selected) ? this.config.mac : this.config.cloud;
	}
}
