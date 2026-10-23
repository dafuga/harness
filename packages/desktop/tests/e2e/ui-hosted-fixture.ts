import type { HostedHost, Input } from './ui-hosted-fixture.types';
import type { Page } from '@playwright/test';
import { projectFixture } from './ui-project-fixture';
export * from './ui-project-fixture';

export const userCode = 'ABCD-EFGH';
export const verificationUrl = 'https://hub.example.invalid/native/handoff-1';

/** The connection as the main process reports it: a code and an address, never a secret. */
function installConnection(input: { userCode: string; verificationUrl: string; state: string }) {
	const host = window as unknown as HostedHost;
	const { state: initial, ...shown } = input;
	const hosted = { state: initial, polls: 0 };
	const listed = host.harness.listProjects as () => Promise<{ kind: string }[]>;
	const actor = { id: 'google:ada', name: 'Ada Example', email: 'ada@example.invalid' };
	const status = () => ({
		configured: true,
		state: hosted.state,
		actor: hosted.state === 'signed-in' ? actor : undefined,
		handoff:
			hosted.state === 'pending'
				? { ...shown, expiresAt: new Date(Date.now() + 300000).toISOString(), interval: 1 }
				: undefined
	});
	Object.assign(host, { __hosted: hosted, __cache: () => {}, __deny: false });
	Object.assign(host.harness, {
		/** Shared projects are listed only to a signed-in device. */
		listProjects: async () =>
			(await listed()).filter((item) => item.kind !== 'shared' || hosted.state === 'signed-in'),
		onCacheStatus: (listener: HostedHost['__cache']) => {
			host.__cache = listener;
			return () => {};
		},
		hostedStatus: async () => {
			hosted.polls++;
			return status();
		},
		connectHosted: async () => {
			hosted.state = 'pending';
			return status();
		},
		disconnectHosted: async () => {
			hosted.state = 'signed-out';
			host.__cache({ projectId: '$projects', status: 'denied' });
			return status();
		}
	});
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
	await page.addInitScript(installConnection, { userCode, verificationUrl, state });
	await page.addInitScript(installHistory);
	return outbox;
}
