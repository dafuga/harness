// @harness-uid u_p43nh5e4yc
import type {
	TrackerOverviewAuthority,
	TrackerOverviewPublisherOptions,
	TrackerOverviewTimers
} from './TrackerOverviewPublisher.types';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { NativeHostedCredential } from '../remote-http-project-adapter/RemoteHttpProjectAdapter';
import { HostedFailureValidator } from '../../../../validators/development-tooling/HostedFailureValidator';

/** Nominal spacing between publish flights, in milliseconds. */
export const OVERVIEW_PUBLISH_INTERVAL_MS = 20_000;

const defaultTimers: TrackerOverviewTimers = {
	set: (callback, ms) => setInterval(callback, ms),
	clear: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

/** A refused credential holds publishing until a new connection; any other failure only skips this flight. */
function isDenied(error: unknown): boolean {
	return error instanceof HostedFailureValidator && error.category === 'denied';
}

/**
 * Main-process background publisher of the display-only tracker overview. It publishes only
 * while a verified owner session exists, runs one flight at a time, and discards any flight whose
 * authority changed. It never retains a previous snapshot across failures.
 */
export class TrackerOverviewPublisher {
	private handle: unknown = null;
	private flight: Promise<void> | null = null;
	private epoch = 0;
	private running = false;
	/** The authority version whose connection was refused or is not the owner; no flight runs for it. */
	private blocked: number | null = null;

	constructor(private options: TrackerOverviewPublisherOptions) {}

	/** Begins the interval and runs one flight immediately. A second start is a no-op. */
	start(): void {
		if (this.running) return;
		this.running = true;
		this.blocked = null;
		const timers = this.options.timers ?? defaultTimers;
		this.handle = timers.set(
			() => void this.tick(),
			this.options.intervalMs ?? OVERVIEW_PUBLISH_INTERVAL_MS
		);
		void this.tick();
	}

	/** Stops the interval and discards any flight still in progress. */
	stop(): void {
		this.running = false;
		this.epoch++;
		if (this.handle !== null) (this.options.timers ?? defaultTimers).clear(this.handle);
		this.handle = null;
	}

	/** Runs one flight unless stopped or one is already in progress. */
	tick(): Promise<void> {
		if (!this.running) return Promise.resolve();
		this.flight ??= this.publish(this.epoch).finally(() => {
			this.flight = null;
		});
		return this.flight;
	}

	private async publish(epoch: number): Promise<void> {
		const authority: TrackerOverviewAuthority = this.options.authority;
		const version = authority.version();
		if (this.blocked === version) return;
		let credential: NativeHostedCredential;
		try {
			credential = await authority.authorize();
		} catch (error) {
			if (isDenied(error)) this.block(version);
			return;
		}
		if (credential.principalId !== this.options.ownerActorId) {
			this.block(version);
			return;
		}
		const snapshot = await this.read();
		if (!this.current(epoch, version, authority)) return;
		try {
			await authority.put(credential, JSON.stringify(snapshot));
		} catch (error) {
			if (isDenied(error)) this.block(version);
		}
	}

	/** Holds publishing for this connection only; a new sign-in changes the version and resumes. */
	private block(version: number): void {
		this.blocked = version;
	}

	private current(epoch: number, version: number, authority: TrackerOverviewAuthority): boolean {
		return this.running && epoch === this.epoch && authority.version() === version;
	}

	private async read(): Promise<OverviewSnapshot> {
		try {
			return await this.options.read();
		} catch {
			return { status: 'unavailable' };
		}
	}
}
