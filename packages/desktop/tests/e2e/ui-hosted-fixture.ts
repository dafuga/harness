import type { HostedConnectionFixture, HostedHost, Input } from './ui-hosted-fixture.types';
import type { Page } from '@playwright/test';
import { projectFixture } from './ui-project-fixture';
export * from './ui-project-fixture';

export const userCode = 'ABCD-EFGH';
export const verificationUrl = 'https://hub.example.invalid/native/handoff-1';

/** The connection as the main process reports it: a code and an address, never a secret. */
function installConnection(input: HostedConnectionFixture) {
	const host = window as unknown as HostedHost;
	const { state: initial, home, tracker, ...shown } = input;
	const state = sessionStorage.getItem('fixtureHostedState') ?? initial;
	const hosted = { state, polls: 0, google: false };
	const listed = host.harness.listProjects as () => Promise<{ kind: string }[]>;
	const actor = { id: 'google:ada', name: 'Ada Example', email: 'ada@example.invalid' };
	const status = () => ({
		configured: true,
		state: hosted.state,
		actor: hosted.state === 'signed-in' ? actor : undefined,
		handoff:
			hosted.state === 'pending'
				? { ...shown, userCode: hosted.google ? '' : shown.userCode }
				: undefined
	});
	Object.assign(host, { __hosted: hosted, __cache: () => {}, __deny: false });
	Object.assign(host.harness, {
		/** Shared projects are listed only to a signed-in device. */
		listProjects: async () => {
			const hubUnavailable = sessionStorage.getItem('fixtureHubUnavailable') === 'yes';
			if (hubUnavailable) host.__cache({ projectId: '$projects', status: 'unavailable' });
			const includeShared = !hubUnavailable && hosted.state === 'signed-in';
			return (await listed()).filter((item) => item.kind !== 'shared' || includeShared);
		},
		homeSnapshot: async () => home,
		trackerInbox: {
			overview: async () => tracker,
			writes: async () => ({ freshness: 'current', value: [] })
		},
		onCacheStatus: (listener: HostedHost['__cache']) => {
			host.__cache = listener;
			return () => {};
		},
		hostedStatus: async () => {
			hosted.polls++;
			if (hosted.state === 'signed-in') sessionStorage.setItem('fixtureHostedState', 'signed-in');
			return status();
		},
		connectHosted: async (input?: { google?: boolean }) => {
			hosted.google = input?.google === true;
			hosted.state = 'pending';
			return status();
		},
		disconnectHosted: async () => {
			hosted.state = 'signed-out';
			sessionStorage.removeItem('fixtureHostedState');
			host.__cache({ projectId: '$projects', status: 'denied' });
			return status();
		}
	});
}

function homeFixture() {
	return {
		home: {
			overview: { status: 'ready', projects: [], machines: [], liveSessions: 0 },
			projectDirectory: [{ name: 'Tracker Orion', state: 'needs-you', needsYou: 2 }],
			agents: [],
			openAsks: ['Review the launch plan', 'Approve the design'].map((question, index) => ({
				itemId: `fixture-orion-${index}`,
				agentId: 'orion',
				agentName: 'Tracker Orion',
				title: question,
				question,
				options: [
					{ label: 'Approve', effect: 'Continue.', recommended: true },
					{ label: 'Hold', effect: 'Wait for review.' }
				],
				since: new Date(Date.now() - 3600000).toISOString()
			})),
			reminders: [
				{
					itemId: 'fixture-reminder',
					title: 'Water the sample plant',
					at: new Date(Date.now() - 3600000).toISOString(),
					repeats: 'Weekly',
					updatedAt: new Date(Date.now() - 86400000).toISOString()
				}
			],
			plans: [],
			scheduled: [],
			pastDue: [],
			providers: { quota: null, routines: null }
		},
		tracker: {
			freshness: 'current',
			value: {
				rows: ['Tracker Orion', 'Other Tracker project'].map((project, index) => ({
					header: {
						id: `fixture-task-${index}`,
						title: index === 0 ? 'Orion task' : 'Unrelated task',
						project,
						status: 'open',
						updatedAt: null,
						dueAt: null
					},
					bucket: 'quiet'
				})),
				reminders: [],
				unresolvedFlags: 0,
				needsYouCapped: false
			}
		}
	};
}

/** The shared project has a paged history and one source that can be refused. */
function installHistory() {
	const host = window as unknown as HostedHost;
	const state = host.__projects;
	const event = (id: string, title: string) => ({
		id,
		at: '2026-10-11T09:00:00.000Z',
		kind: 'commit',
		title,
		detail: `Detail of ${title}`,
		commit: state.data.ids.tip,
		version: null
	});
	Object.assign(state.data.projects[2].entities[0], {
		history: [event('a', 'First page event A'), event('b', 'First page event B')],
		historyCoverage: { complete: false, nextPage: 2, loadedPages: 1 },
		sources: ['src/activity.svelte']
	});
	const second = [event('b', 'First page event B'), event('c', 'Second page event C')];
	const pages: Record<number, unknown> = {
		2: { entries: second, complete: false, nextPage: 3 },
		3: { entries: [event('d', 'Third page event D')], complete: true, nextPage: null }
	};
	const read = host.harness.source as (input: Input) => Promise<unknown>;
	Object.assign(host.harness, {
		history: async (input: Input) => {
			state.own('history', input);
			return pages[Number(input.page)];
		},
		/** Like the main process: a refused read says so on the cache channel before it rejects. */
		source: async (input: Input) => {
			if (!host.__deny) return read(input);
			host.__cache({ projectId: String(input.projectId), status: 'denied' });
			await new Promise((done) => setTimeout(done, 100));
			throw new Error('forbidden');
		}
	});
}

/** The two-local-one-shared bridge with the hosted connection, cache channel and history. */
export async function hostedFixture(page: Page, state = 'signed-in') {
	const outbox = await projectFixture(page);
	await page.addInitScript(installConnection, {
		userCode,
		verificationUrl,
		expiresAt: new Date(Date.now() + 300000).toISOString(),
		interval: 1,
		state,
		...homeFixture()
	});
	await page.addInitScript(installHistory);
	return outbox;
}

async function readyForCapture(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(Array.from(document.images, (image) => image.decode()));
	});
}

export async function captureHostedSignIn(page: Page) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await readyForCapture(page);
	await page.screenshot({
		path: `${process.env.HEADLESS_RUN_ARTIFACTS ?? '/tmp'}/harness-desktop-account-${process.env.SCREENSHOT_LABEL}.png`
	});
}

export async function captureSignedInHome(page: Page) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	for (const [name, width, height] of [
		['desktop', 1440, 900],
		['tablet', 920, 800],
		['phone', 390, 844]
	] as const) {
		await page.setViewportSize({ width, height });
		await readyForCapture(page);
		await page.screenshot({
			fullPage: true,
			animations: 'disabled',
			path: `${process.env.HEADLESS_RUN_ARTIFACTS ?? '/tmp'}/signed-in-home-${process.env.SCREENSHOT_LABEL}-${name}.png`
		});
	}
	await page.setViewportSize({ width: 1440, height: 900 });
}
