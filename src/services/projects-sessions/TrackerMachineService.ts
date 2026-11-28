// @harness-uid u_cnfb5ax3bj
import { TrackerHostWorkRepository } from '../../repositories/projects-sessions/TrackerHostWorkRepository';
import type { TrackerHostWorkClaim } from '../../repositories/projects-sessions/TrackerHostWorkRepository.types';
import { trackerHostWork } from '../../utils/projects-sessions/trackerHostWork';
import type { TrackerHostWork } from '../../utils/projects-sessions/trackerHostWork.types';
import { TrackerMachineRepository } from '../../repositories/projects-sessions/TrackerMachineRepository';
import { trackerResourceSample } from '../../repositories/projects-sessions/tracker-machine-repository/trackerResourceSample';
import { placeTrackerWork } from '../../utils/projects-sessions/placeTrackerWork';
import {
	trackerMachineRole,
	trackerMacLaunchLoad,
	trackerMachineStatus
} from '../../utils/projects-sessions/trackerMachineStatus';
import type {
	TrackerMachineRow,
	TrackerMachineRunRef,
	TrackerPlacementRequest,
	TrackerResourceSample
} from '../../utils/projects-sessions/trackerMachine.types';
import { trackerFleetNodes } from '../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerFleetReport,
	TrackerMachineServiceOptions
} from './TrackerMachineService.types';
import type { TrackerPersistenceService } from './TrackerPersistenceService';

const sampleEvery = 60_000;
/** Two sample intervals and the time one exchange may take. */
const grantSampleAge = 2 * sampleEvery + 15_000;

/** The fleet's resource readings: this computer's samples and those received from peers. */
export class TrackerMachineService {
	readonly repository: TrackerMachineRepository;
	private readonly hostWork: TrackerHostWorkRepository;
	private readonly peerWork = new Map<string, { at: number; work: TrackerHostWork[] }>();
	private local?: TrackerResourceSample;
	private nextSample = -Infinity;

	constructor(
		readonly store: TrackerPersistenceService,
		private readonly options: TrackerMachineServiceOptions
	) {
		this.repository = new TrackerMachineRepository(store.database);
		this.hostWork = new TrackerHostWorkRepository(store.database);
	}

	/** Sample this computer at most once a minute and return the latest reading. */
	async sampleLocal(): Promise<TrackerResourceSample | undefined> {
		const { sampler, now } = this.options;
		const at = now();
		if (!sampler || at < this.nextSample) return this.local;
		this.nextSample = at + sampleEvery;
		this.local = await sampler.sample(at);
		this.repository.record(this.store.node, this.local, at);
		this.repository.prune(at);
		return this.local;
	}

	/** Record resources and replace each origin’s remote work snapshot as its reports arrive. */
	ingest(samples: readonly TrackerFleetReport[]): void {
		for (const value of samples) {
			if (!isReport(value) || value.node === this.store.node) continue;
			const resources = trackerResourceSample.safeParse(value.resources).data;
			if (resources) this.repository.record(value.node, resources, this.options.now());
			this.ingestHostWork(value);
		}
	}

	private ingestHostWork(value: { node: string; at?: unknown; host_work?: unknown }): void {
		const at = typeof value.at === 'string' ? Date.parse(value.at) : NaN;
		const now = this.options.now();
		if (!Number.isFinite(at) || at > now + trackerHostWork.leaseMs) return;
		if (at < (this.peerWork.get(value.node)?.at ?? -Infinity)) return;
		const work = trackerHostWork.report.safeParse(value.host_work).data ?? [];
		this.peerWork.set(value.node, {
			at,
			work: work.filter(
				({ host, expires_at }) =>
					host !== value.node &&
					trackerFleetNodes.includes(host) &&
					expires_at <= at + trackerHostWork.leaseMs &&
					expires_at > now
			)
		});
	}

	updateHostWork(claim: TrackerHostWorkClaim, release: boolean): boolean {
		if (!release) return this.hostWork.renew(claim, this.options.now());
		this.hostWork.release(claim);
		return true;
	}

	localHostWork() {
		return this.hostWork.active(this.options.now());
	}

	/** One row per fleet computer, with any other computer that has reported. */
	rows(): TrackerMachineRow[] {
		const now = this.options.now();
		const latest = this.repository.latest();
		const remote = remoteRunsByHost(
			now,
			new Map([
				[this.store.node, this.localHostWork()],
				...[...this.peerWork].map(([node, { work }]) => [node, work] as const)
			])
		);
		const nodes = new Set([...trackerFleetNodes, ...latest.keys(), this.store.node]);
		return [...nodes].sort().map((node) => {
			const sample = latest.get(node) ?? null;
			const recent = this.repository.recent(node, now);
			const refs = remote.get(node) ?? [];
			return {
				node,
				role: trackerMachineRole(node),
				...trackerMachineStatus(sample, recent, now),
				remote_runs: refs.length,
				remote_run_refs: refs,
				sample
			};
		});
	}

	history(node: string, hours: number): TrackerResourceSample[] {
		return this.repository.history(node, this.options.now() - hours * 3_600_000);
	}

	place(request: TrackerPlacementRequest) {
		return placeTrackerWork(this.rows(), request);
	}

	/**
	 * Why a peer may not start a due task now. A computer that has never reported resources runs
	 * an earlier release and keeps its grant; its own launcher still applies its guards.
	 */
	peerStartHold(node: string): string | null {
		const row = this.rows().find((candidate) => candidate.node === node);
		if (!row?.sample) return null;
		if ((row.age_s ?? Infinity) * 1000 > grantSampleAge) return 'no fresh machine sample';
		if (row.status === 'overloaded') return `${node} is overloaded: ${row.reasons[0]}`;
		const oneMinute = row.sample.load[0];
		if ((row.role === 'primary' || row.role === 'runner') && oneMinute >= trackerMacLaunchLoad)
			return `${node} is overloaded: 1-min load ${oneMinute} (need under ${trackerMacLaunchLoad})`;
		return null;
	}
}

/** Distinct source runs per destination, including concurrent SSH and Colima leases once. */
function remoteRunsByHost(now: number, snapshots: ReadonlyMap<string, TrackerHostWork[]>) {
	const hosts = new Map<string, Map<string, TrackerMachineRunRef>>();
	for (const [node, snapshot] of snapshots) {
		for (const { run, host, expires_at } of snapshot) {
			if (expires_at <= now) continue;
			const refs = hosts.get(host) ?? new Map<string, TrackerMachineRunRef>();
			refs.set(`${node}:${run}`, { node, id: run });
			hosts.set(host, refs);
		}
	}
	return new Map([...hosts].map(([host, refs]) => [host, [...refs.values()]]));
}

function isReport(
	value: TrackerFleetReport
): value is { node: string; resources?: object; at?: unknown; host_work?: unknown } {
	return (
		typeof value === 'object' && value !== null && 'node' in value && typeof value.node === 'string'
	);
}
