import type { Page, TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../../../../test/support/browserTest';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { recordCapture } from '../../../../src/utils/reports-media/record-capture/recordCapture';
import { pageWorkload } from '../../../desktop/tests/e2e/page-workload';
import { ada, hostedFixture, type HostedState } from './hosted-fixture';
import type { OverviewControl, OverviewMode, Viewport } from './tracker-overview-fixture.types';
import type {
	OverviewCard,
	OverviewItem,
	OverviewSnapshot
} from '../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
export type {
	OverviewCall,
	OverviewControl,
	OverviewMode,
	Viewport
} from './tracker-overview-fixture.types';

/** A second, signed-in account that the tracker does not name as owner. Synthetic. */
export const grace = {
	id: 'google:grace',
	email: 'grace@example.invalid',
	name: 'Grace Example',
	emailVerified: true
};

const at = '2026-11-20T10:00:00.000Z';

function item(
	id: string,
	title: string,
	status: OverviewItem['status'],
	live = false
): OverviewItem {
	return { id, title, status, updatedAt: at, due: null, live, stale: false };
}

const cutover = item('SYN-1', 'Confirm the cutover window', 'in_progress');
const audit = item('SYN-2', 'Rotate the audit key', 'blocked');
const docs = item('SYN-3', 'Draft the release notes', 'in_progress', true);
const notes = item('SYN-4', 'Summarise the field notes', 'open');
const shipped = item('SYN-5', 'Ship the 2.4 build', 'done');
const base = { liveSessions: 0, updatedAt: at, milestone: null };
const projects: OverviewCard[] = [
	{
		...base,
		agent: 'synthetic-sync',
		state: 'needs-you',
		counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
		items: [cutover],
		attention: { item: cutover, text: 'Approve the cutover window?' },
		blocked: null
	},
	{
		...base,
		agent: 'synthetic-relay',
		state: 'blocked',
		counts: { open: 0, in_progress: 0, blocked: 1, done: 0 },
		items: [audit],
		attention: null,
		blocked: { item: audit, text: 'Waiting on the audit key rotation' }
	},
	{
		...base,
		agent: 'synthetic-docs',
		state: 'active',
		liveSessions: 1,
		counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
		items: [docs],
		attention: null,
		blocked: null,
		milestone: { text: 'Drafted the outline', at }
	},
	{
		...base,
		agent: 'synthetic-notes',
		state: 'quiet',
		counts: { open: 1, in_progress: 0, blocked: 0, done: 0 },
		items: [notes],
		attention: null,
		blocked: null
	},
	{
		...base,
		agent: 'synthetic-release',
		state: 'done',
		counts: { open: 0, in_progress: 0, blocked: 0, done: 1 },
		items: [shipped],
		attention: null,
		blocked: null
	}
];

/** Five synthetic projects, one per state, with one computer and one live session. */
export function syntheticOverview(): OverviewSnapshot {
	return {
		status: 'ready',
		projects: structuredClone(projects),
		machines: [
			{ name: 'synthetic-computer', status: 'ok' },
			{ name: 'synthetic-laptop', status: 'busy' }
		],
		liveSessions: 1
	};
}

function answer(control: OverviewControl, state: HostedState): { status: number; json: unknown } {
	if (!state.signedIn) return { status: 401, json: { error: 'session-required' } };
	const owner = state.actor.id === ada.id;
	if (!owner || control.mode === 'denied')
		return { status: 403, json: { error: 'owner-required' } };
	if (control.mode === 'unavailable') return { status: 503, json: { status: 'unavailable' } };
	if (control.mode === 'empty') {
		return { status: 200, json: { status: 'ready', projects: [], machines: [], liveSessions: 0 } };
	}
	return { status: 200, json: syntheticOverview() };
}

/**
 * The hosted fixture for the signed-in Hub, with the owner endpoint answered for this page only.
 * The owner route is registered after the shared fixture, so it takes this one address and
 * every other answer stays as the shared fixture gives it.
 */
export async function overviewFixture(
	page: Page,
	mode: OverviewMode = 'ready',
	options: Partial<HostedState> = {}
) {
	const state = await hostedFixture(page, options);
	let open = () => {};
	const held = new Promise<void>((resolve) => {
		open = resolve;
	});
	const overview: OverviewControl = { mode, calls: [], release: () => open() };
	await page.route('**/api/tracker-overview/deliveries?project=*', (route) =>
		route.fulfill({ json: { deliveries: [], cursor: null } })
	);
	await page.route('**/api/tracker-overview', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		overview.calls.push({ method: request.method(), path: url.pathname, query: url.search });
		if (overview.mode === 'held') await held;
		const found = answer(overview, state);
		return route.fulfill({
			status: found.status,
			contentType: 'application/json',
			body: JSON.stringify(found.json)
		});
	});
	return { state, overview };
}

const scenario = JSON.parse(
	readFileSync(
		join(import.meta.dirname, '../../../../specification/scenarios/project-overview-hub-page.json'),
		'utf8'
	)
) as ScenarioManifest;

export const viewports: Viewport[] = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
];

export function refusal(
	browserErrors: { expectError(error: object): void },
	origin: string,
	answer: { status: number; text: string; reason: string },
	loads = 1
) {
	for (let load = 0; load < loads; load++) {
		browserErrors.expectError({
			type: 'console',
			message: `Failed to load resource: the server responded with a status of ${answer.status} (${answer.text})`,
			source: new URL('/api/tracker-overview', origin).href,
			reason: answer.reason
		});
	}
}

export async function open(page: Page, viewport: Viewport, path = '/tracker-overview') {
	await page.setViewportSize({ width: viewport.width, height: viewport.height });
	await page.goto(path);
}

async function buildOf(page: Page): Promise<string> {
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	if (process.env.HARNESS_VERIFY === '1') {
		expect(buildId, 'The compiled Hub page must carry its build identity').toBeTruthy();
		expect(process.env.HARNESS_VERIFY_REVISION).toMatch(/^[a-f0-9]{40}$/);
	}
	return buildId ?? 'unstamped';
}

export async function capture(page: Page, testInfo: TestInfo, state: string, viewport: Viewport) {
	await page.evaluate(() => document.fonts.ready);
	const buildId = await buildOf(page);
	const body = await page.screenshot({ animations: 'disabled', caret: 'hide' });
	await testInfo.attach(`${state}-${viewport.id}.png`, { body, contentType: 'image/png' });
	recordCapture(
		{
			evidence: 'hub-overview-screens',
			kind: 'screenshot',
			state,
			viewport: viewport.id,
			file: `hub-tracker-overview-${state}-${viewport.id}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision: process.env.HARNESS_VERIFY_REVISION ?? '' },
			note: 'Actual compiled Hub page over synthetic tracker records; no live tracker read.'
		},
		body
	);
	await pageWorkload(page, scenario, { state, name: viewport.id, viewport: viewport.id, buildId });
}
