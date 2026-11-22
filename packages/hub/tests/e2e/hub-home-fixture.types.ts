import type { HomeAgentState } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

import type { hubHomeFixture } from './hub-home-fixture';

export type CapturePosition = readonly [string, 'dark' | 'light', HomeFixtureState];
export type HomeFixture = Awaited<ReturnType<typeof hubHomeFixture>>;

export type HomeFixtureState = 'default' | 'busy' | 'empty' | 'loading';
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
