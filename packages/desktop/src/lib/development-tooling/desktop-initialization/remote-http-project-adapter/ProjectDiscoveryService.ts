import type { SnapshotPort, HeldDiscovery } from './ProjectDiscoveryService.types';
import { createHash } from 'node:crypto';
import type { CacheIdentity } from '../../../../../../collaboration/src/models/Collaboration.types';
import type { DesktopProject } from '../../../../models/projects-sessions/ProjectContext.types';
import type {
	HostedHttpAdapter,
	NativeHostedCredential
} from '../../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import { RemoteProjectResponseValidator } from '../../../../validators/projects-sessions/RemoteProjectResponseValidator';
import type {
	HostedReadOptions,
	HostedReadService
} from '../../../../services/development-tooling/HostedReadService';

/** The read every discovery is kept under; HostedReadService scopes it by origin and principal. */
const discovery = { projectId: '$projects', key: 'projects' };

/**
 * Lists a principal's hosted projects, owned and joined. The list is read every time; a snapshot
 * only for a project this device does not hold yet, so an unchanged list costs one read. What a
 * current list no longer names is purged here and reported denied; an empty list is kept as
 * nothing. A list read while the hub is away is the kept copy, and it changes nothing.
 */
export class ProjectDiscoveryService {
	private validator = new RemoteProjectResponseValidator();
	private queue: Promise<unknown> = Promise.resolve();
	constructor(
		private projection: SnapshotPort,
		private http: HostedHttpAdapter,
		private reads: HostedReadService,
		private options: HostedReadOptions
	) {}
	/** One discovery at a time, so the next one finds what this one kept. */
	projects(): Promise<DesktopProject[]> {
		const run = this.queue.then(() => this.discover());
		this.queue = run.catch(() => undefined);
		return run;
	}
	private async discover() {
		const before = await this.options.credentials();
		const held = await this.held(before);
		const listed = await this.reads.read(
			discovery,
			async () => ({ value: this.validator.projects(await this.http.json('/api/projects')) }),
			(value) => this.validator.projects(value)
		);
		if (!before || !(await this.same(before)))
			throw new Error('Hosted authority changed during project discovery.');
		if (this.options.cache && !listed.offline)
			await this.settle(before.principalId, listed.value, held);
		if (!(await this.same(before)))
			throw new Error('Hosted authority changed during project discovery.');
		return listed.value;
	}
	/** Purges what left, reads what came, keeps a changed list, then says what was taken away. */
	private async settle(
		principalId: string,
		projects: DesktopProject[],
		held: HeldDiscovery | null
	) {
		const known = new Set(held?.projects.map((item) => item.id));
		const removed = await this.remove(principalId, projects, held);
		const version = this.options.authorityVersion?.();
		const primed = await this.prime(projects.filter((item) => !known.has(item.id)));
		/** A refusal while priming may have ended the session; its list is then not kept. */
		if (version !== this.options.authorityVersion?.()) await this.http.authorize();
		await this.retain(projects, primed[0] ?? held?.identity, held?.projects);
		for (const item of removed)
			this.options.onCacheStatus?.({ projectId: item.id, status: 'denied' });
	}
	private async remove(
		principalId: string,
		projects: DesktopProject[],
		held: HeldDiscovery | null
	) {
		const current = new Set(projects.map((item) => item.id));
		const removed = (held?.projects ?? []).filter((item) => !current.has(item.id));
		for (const item of removed) await this.options.cache?.purge(principalId, item.id);
		return removed;
	}
	private async retain(
		projects: DesktopProject[],
		base: CacheIdentity | undefined,
		previous: DesktopProject[] | undefined
	) {
		if (base && projects.length && JSON.stringify(projects) !== JSON.stringify(previous))
			await this.keep(projects, base);
	}

	/** One project that cannot be read leaves it without a kept copy, and the rest listed. */
	private async prime(projects: DesktopProject[]) {
		const identities: CacheIdentity[] = [];
		for (const project of projects) {
			const read = { projectId: project.id, branch: null, commit: null };
			const snapshot = await this.projection.snapshot(read).catch(() => null);
			if (snapshot?.cache && snapshot.cache.status !== 'offline')
				identities.push(snapshot.cache.identity);
		}
		return identities;
	}
	/** Bound to the identity a project of this principal was read under, profiled by the list. */
	private async keep(projects: DesktopProject[], base: CacheIdentity) {
		const profile = createHash('sha256')
			.update(JSON.stringify([projects, base]))
			.digest('hex');
		const identity = { ...base, projectId: discovery.projectId, profile };
		await this.reads.read(
			discovery,
			async () => ({ value: projects, identity }),
			(value) => this.validator.projects(value)
		);
	}
	/** The list this device kept for this principal, under the scope its read was kept by. */
	private async held(credential: NativeHostedCredential | null): Promise<HeldDiscovery | null> {
		if (!this.options.cache || !credential) return null;
		const { origin, principalId } = credential;
		const scope = JSON.stringify([origin, principalId, discovery.projectId, discovery.key]);
		const entry = await this.options.cache.lookup(scope);
		if (!entry || entry.identity.principalId !== principalId) return null;
		try {
			return { projects: this.validator.projects(entry.value), identity: entry.identity };
		} catch {
			return null;
		}
	}
	/** The session the list was read under is still the one signed in. */
	private async same(before: NativeHostedCredential) {
		return JSON.stringify(await this.options.credentials()) === JSON.stringify(before);
	}
}
