import type {
	HomeAgentState,
	OwnerHomeSnapshot
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

import type { hubHomeFixture } from './hub-home-fixture';

export type CapturePosition = readonly [string, 'dark' | 'light', HomeFixtureState];
export type HomeFixture = Awaited<ReturnType<typeof hubHomeFixture>>;

/**
 * Where Home comes from. `linked` is the installed app. `published` is the stored snapshot of a
 * Mac that opted in to publishing, which is off in the installed app: only name it to test that
 * path itself.
 */
export type HomeSource = 'linked' | 'published';
export type Chat = { id: string };
export interface HomeSourceInput {
	snapshot: OwnerHomeSnapshot;
	controlled: Set<string>;
	held?: Promise<void>;
	granted: () => boolean;
	available: () => boolean;
}
export type HomeFixtureState = 'default' | 'busy' | 'empty' | 'loading' | 'unavailable';
export type FixtureProject = {
	name: string;
	apps: number;
	pages: number;
	components: number;
	change: string;
	when: string;
	hash: string;
};
export interface MockupHomeData {
	machines: { name: string; status: 'ok' | 'busy' | 'overloaded' | 'offline' }[];
	agents: { name: string; state: HomeAgentState; machine: string; model: string; task: string }[];
	plans: {
		title: string;
		project: string;
		status: string;
		done: number;
		steps: number;
		updated: string;
	}[];
	scheduled: {
		title: string;
		day: string;
		time: string;
		agent: string;
		machine: string;
		repeat: string;
		paused?: boolean;
	}[];
	projects: FixtureProject[];
	wip: { title: string; project: string; eta: string; tone?: string; status: string }[];
	quota: {
		provider: string;
		plan: string;
		account: string;
		stale?: boolean;
		credits?: { left: string };
		limits: { label: string; left: number; reset: string }[];
		history: number[];
		top: [string, number][];
	}[];
}
