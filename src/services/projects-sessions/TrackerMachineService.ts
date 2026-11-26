// @harness-uid u_cnfb5ax3bj
import { TrackerMachineRepository } from '../../repositories/projects-sessions/TrackerMachineRepository';
import { trackerResourceSample } from '../../repositories/projects-sessions/tracker-machine-repository/trackerResourceSample';
import { placeTrackerWork } from '../../utils/projects-sessions/placeTrackerWork';
import {
	trackerMachineRole,
	trackerMachineStatus
} from '../../utils/projects-sessions/trackerMachineStatus';
import type {
	TrackerMachineRow,
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
	private local?: TrackerResourceSample;
	private nextSample = -Infinity;

	constructor(
		readonly store: TrackerPersistenceService,
		private readonly options: TrackerMachineServiceOptions
	) {
		this.repository = new TrackerMachineRepository(store.database);
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

	/** Record the resource readings carried by fleet samples. Other fields are ignored. */
	ingest(samples: readonly TrackerFleetReport[]): void {
		for (const value of samples) {
			if (!isReport(value) || value.node === this.store.node) continue;
			const resources = trackerResourceSample.safeParse(value.resources).data;
			if (resources) this.repository.record(value.node, resources, this.options.now());
		}
	}

	/** One row per fleet computer, with any other computer that has reported. */
	rows(): TrackerMachineRow[] {
		const now = this.options.now();
		const latest = this.repository.latest();
		const nodes = new Set([...trackerFleetNodes, ...latest.keys(), this.store.node]);
		return [...nodes].sort().map((node) => {
			const sample = latest.get(node) ?? null;
			const recent = this.repository.recent(node, now);
			return {
				node,
				role: trackerMachineRole(node),
				...trackerMachineStatus(sample, recent, now),
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
		return row.status === 'overloaded' ? `${node} is overloaded: ${row.reasons[0]}` : null;
	}
}

function isReport(value: TrackerFleetReport): value is { node: string; resources?: object } {
	return (
		typeof value === 'object' && value !== null && 'node' in value && typeof value.node === 'string'
	);
}
