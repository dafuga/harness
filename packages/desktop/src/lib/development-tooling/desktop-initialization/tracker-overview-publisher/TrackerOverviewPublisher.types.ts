// @harness-uid u_p43nh5e4yc
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import type { NativeHostedCredential } from '../remote-http-project-adapter/RemoteHttpProjectAdapter';

/** The verified Hub connection the publisher may use. Built from the main-process session only. */
export interface TrackerOverviewAuthority {
	/** Resolves the connected owner credential, or rejects when there is no verified session. */
	authorize(): Promise<NativeHostedCredential>;
	/** Changes on sign-in, disconnect or account change; a flight started earlier is discarded. */
	version(): number;
	/** Sends one PUT of the display snapshot to the owner-only endpoint. */
	put(credential: NativeHostedCredential, body: string): Promise<void>;
}

export interface TrackerOverviewTimers {
	set(callback: () => void, ms: number): unknown;
	clear(handle: unknown): void;
}

export interface TrackerOverviewPublisherOptions {
	authority: TrackerOverviewAuthority;
	/** The canonical Hub actor ID of the owner. Any other verified actor is never read or sent to. */
	ownerActorId: string;
	/** The fixed local tracker read; it never throws, failures arrive as an unavailable snapshot. */
	read: () => Promise<OverviewSnapshot>;
	publishHome?: (credential: NativeHostedCredential, current: () => boolean) => Promise<void>;
	intervalMs?: number;
	timers?: TrackerOverviewTimers;
}

export interface TrackerOverviewFactoryInput {
	/** Absent when no verified Hub origin is configured; the publisher is then not created. */
	authority?: TrackerOverviewAuthority;
	/**
	 * The process environment. Publishing runs only when HARNESS_TRACKER_OVERVIEW_PUBLISH is 1 and
	 * HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID names the canonical owner actor.
	 */
	env: Record<string, string | undefined>;
	read?: () => Promise<OverviewSnapshot>;
}
