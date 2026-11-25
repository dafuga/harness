import type { hubHomeFixture } from './hub-home-fixture';

export type CapturePosition = readonly [string, 'dark' | 'light', HomeFixtureState];
export type HomeFixture = Awaited<ReturnType<typeof hubHomeFixture>>;

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
