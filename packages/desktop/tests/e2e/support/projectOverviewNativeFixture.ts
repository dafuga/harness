import type { Page } from '@playwright/test';
import type {
	OverviewItem,
	OverviewSnapshot
} from '../../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import type { OwnerHomeSnapshot } from '../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type { OverviewBridge } from './projectOverviewNativeFixture.types';

const at = '2026-11-20T20:41:00.000Z';
const item = (
	id: string,
	title: string,
	status: OverviewItem['status'],
	extra: Partial<{ live: boolean; stale: boolean; due: string | null }> = {}
): OverviewItem => ({
	id,
	title,
	status,
	updatedAt: at,
	due: extra.due ?? null,
	live: extra.live ?? false,
	stale: extra.stale ?? false
});

/**
 * Synthetic tracker records only: one card per project state. No real project, person or
 * machine name appears here.
 */
export const overviewSnapshot: OverviewSnapshot = {
	status: 'ready',
	projects: [
		{
			agent: 'fixture-needs',
			state: 'needs-you',
			liveSessions: 0,
			counts: { open: 1, in_progress: 0, blocked: 0, done: 0 },
			items: [item('fx-1', 'Synthetic question item', 'open')],
			attention: {
				item: item('fx-1', 'Synthetic question item', 'open'),
				text: 'Synthetic question for the owner?'
			},
			blocked: null,
			milestone: null,
			updatedAt: at
		},
		{
			agent: 'fixture-blocked',
			state: 'blocked',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 1, done: 0 },
			items: [item('fx-2', 'Synthetic blocked item', 'blocked')],
			attention: null,
			blocked: {
				item: item('fx-2', 'Synthetic blocked item', 'blocked'),
				text: 'Synthetic blocked reason'
			},
			milestone: null,
			updatedAt: at
		},
		{
			agent: 'fixture-active',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [item('fx-3', 'Synthetic live item', 'in_progress', { live: true })],
			attention: null,
			blocked: null,
			milestone: { text: 'Synthetic milestone', at },
			updatedAt: at
		},
		{
			agent: 'fixture-quiet',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [item('fx-4', 'Synthetic stale item', 'in_progress', { stale: true })],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: at
		},
		{
			agent: 'fixture-done',
			state: 'done',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 2 },
			items: [item('fx-5', 'Synthetic finished item', 'done')],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: at
		}
	],
	machines: [
		{ name: 'fixture-offline', status: 'offline' },
		{ name: 'fixture-runner', status: 'ok' },
		{ name: 'fixture-computer', status: 'busy' }
	],
	liveSessions: 1
};

export const overviewHomeSnapshot: OwnerHomeSnapshot = {
	overview: overviewSnapshot,
	agents: [],
	plans: [],
	scheduled: [],
	providers: { routines: null, quota: null },
	liveOverview: {
		machines: overviewSnapshot.machines,
		readAt: at,
		hiddenRuns: 0,
		omittedRows: 0,
		projects: [
			{
				agent: 'fixture-active',
				running: 1,
				counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
				updatedAt: at,
				rows: [
					{
						key: 'fixture-live-work',
						itemId: 'fx-3',
						title: 'Synthetic live item',
						state: 'running',
						status: 'in_progress',
						stage: 'build',
						outcome: null,
						now: 'Synthetic milestone',
						owner: 'Fixture owner',
						computer: 'fixture-computer',
						model: 'fixture-model',
						startedAt: at,
						updatedAt: at
					}
				]
			}
		]
	}
};

/** Installs the window bridge of the desktop app, answering the overview as `mode` says. */
export async function fakeOverviewBridge(
	page: Page,
	mode: OverviewBridge,
	home?: OwnerHomeSnapshot
) {
	await page.addInitScript(installBridge, { mode, snapshot: overviewSnapshot, home });
}

function installBridge(input: {
	mode: OverviewBridge;
	snapshot: unknown;
	home?: OwnerHomeSnapshot;
}) {
	if (input.mode === 'web') return;
	const overview =
		input.mode === 'absent'
			? {}
			: {
					projectOverview: async () => {
						if (input.mode === 'refused') throw new Error('Desktop operation unavailable.');
						return input.snapshot;
					}
				};
	const home = input.home
		? {
				homeSnapshot: async () => input.home,
				hostedStatus: async () => ({
					configured: true,
					state: 'signed-in',
					actor: { id: 'fixture-owner', name: 'Fixture owner' }
				})
			}
		: {};
	Object.assign(window, {
		harness: { listProjects: async () => [], ...overview, ...home },
		harnessRemote: {
			status: async () => ({ supported: false, enabled: false, state: 'disabled' }),
			onStatus: () => () => {}
		}
	});
}

/** Waits for the fonts, then records the state of the viewport when screenshots were asked for. */
export async function captureOverview(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(() => document.fonts.ready);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? 'local';
	await page.screenshot({
		path: `/tmp/harness-env-evidence/project-overview-${name}-${revision}.png`
	});
}
