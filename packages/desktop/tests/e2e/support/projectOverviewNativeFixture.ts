import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { OverviewSnapshot } from '../../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import { readProjectOverview } from '../../../../reports/src/lib/projects-sessions/project-overview/readProjectOverview';
import { syntheticTrackerPayloads, TRACKER_URLS } from './projectOverviewElectronFixture';
import type { OverviewBridge } from './projectOverviewNativeFixture.types';

/** The same owner fixture is consumed by Electron, the paired renderer, and native iOS. */
export async function fixtureOverview(now = Date.now()): Promise<OverviewSnapshot> {
	const payloads = syntheticTrackerPayloads(now);
	const mock = new Map(
		Object.entries(TRACKER_URLS).map(([key, url]) => [url, payloads[key as keyof typeof payloads]])
	);
	const fetcher = async (url: RequestInfo | URL) => {
		const data = mock.get(String(url));
		return data ? Response.json(data) : new Response(null, { status: 404 });
	};
	const snapshot = await readProjectOverview(fetcher as typeof fetch, now);
	return snapshot.status === 'ready'
		? {
				...snapshot,
				providerBudgets: [
					{
						provider: 'claude',
						readAt: new Date(now).toISOString(),
						limits: [
							{ label: 'Weekly', left: 72, resetsAt: new Date(now + 86_400_000).toISOString() }
						]
					}
				]
			}
		: snapshot;
}

/** Installs the window bridge of the desktop app, answering the overview as `mode` says. */
export async function fakeOverviewBridge(page: Page, mode: OverviewBridge) {
	await page.addInitScript(installBridge, { mode, snapshot: await fixtureOverview() });
}

function installBridge(input: { mode: OverviewBridge; snapshot: unknown }) {
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
	Object.assign(window, {
		harness: { listProjects: async () => [], ...overview },
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
	await mkdir('/tmp/harness-env-evidence', { recursive: true });
	const revision = process.env.HARNESS_VERIFY_REVISION ?? 'local';
	await page.screenshot({
		path: `/tmp/harness-env-evidence/project-overview-${name}-${revision}.png`
	});
}
