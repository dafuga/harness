import { afterEach, expect, test, vi } from 'vitest';
import { harnessClient } from '../src/utils/harnessClient';
import { activityClient } from '../src/components/projects-sessions/site-activity/activityClient';
import { providerPickerClient } from '../src/utils/providerPickerClient';
import { history } from './explorerFixture';
import type { Shown } from '../../../src/workflows/runActivity';
import type { PickerSnapshot } from '../../../src/core/pickerTypes';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test('history clients share pending reads, retry refused reads and isolate injected transports', async () => {
	const index = history();
	const fetcher = vi
		.fn()
		.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
		.mockResolvedValueOnce(Response.json(index));
	const transport = Object.assign(fetcher, { preconnect: vi.fn() });
	const client = harnessClient('/fixture', transport);
	const pending = client.index();
	expect(client.index()).toBe(pending);
	await expect(pending).rejects.toThrow('index.json could not be loaded (503)');
	expect(await client.index()).toEqual(index);
	expect(await client.index()).toEqual(index);
	expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
		'/fixture/data/index.json',
		'/fixture/data/index.json'
	]);
	expect(harnessClient('/fixture', transport)).not.toBe(client);
	expect(harnessClient('/shared-client-fixture')).toBe(harnessClient('/shared-client-fixture'));
});

const shown: Shown = {
	activity: {
		schemaVersion: 1,
		kind: 'live',
		repository: { name: 'fixture', branch: 'main', head: null },
		asOf: null,
		loops: { total: 0, types: [] },
		work: [],
		files: []
	},
	live: {
		sampledAt: '2026-10-22T00:00:00Z',
		worktrees: [],
		agents: { tracking: 'never-used', working: null, unreadable: 0, roster: [] }
	}
};

test('activity polling refuses overlapping reads and ignores a late result after stop', async () => {
	vi.useFakeTimers();
	const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
	vi.stubGlobal('document', document);
	let deliver!: (response: Response) => void;
	const fetcher = vi.fn(
		(_url: string, _options: RequestInit) =>
			new Promise<Response>((done) => {
				deliver = done;
			})
	);
	vi.stubGlobal('fetch', fetcher);
	const arrived = vi.fn(),
		missed = vi.fn();
	const client = activityClient(arrived, missed);
	try {
		const first = client.refresh();
		await client.refresh();
		expect(fetcher).toHaveBeenCalledOnce();
		deliver(Response.json(shown));
		await first;
		expect(arrived).toHaveBeenCalledWith(shown);
		const late = client.refresh();
		client.stop();
		deliver(Response.json(shown));
		await late;
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(arrived).toHaveBeenCalledOnce();
		expect(missed).not.toHaveBeenCalled();
		expect(fetcher.mock.calls[1][1].signal?.aborted).toBe(true);
	} finally {
		client.stop();
	}
});

test('the picker preview sends explicit tool calls and reports transport refusal', async () => {
	const snapshot: PickerSnapshot = {
		sessionId: null,
		defaultProvider: 'openai',
		active: null,
		request: null,
		models: [],
		controlConnected: false,
		message: 'Synthetic preview transport.'
	};
	const window: { parent?: unknown } = {};
	window.parent = window;
	vi.stubGlobal('window', window);
	vi.stubGlobal('document', { body: { dataset: { pickerPreview: 'true' } } });
	const fetcher = vi
		.fn()
		.mockResolvedValueOnce(Response.json(snapshot))
		.mockResolvedValueOnce(new Response('Refused', { status: 403 }));
	vi.stubGlobal('fetch', fetcher);
	const receive = vi.fn();
	const client = await providerPickerClient(receive);
	try {
		expect(client.preview).toBe(true);
		expect(receive).toHaveBeenCalledWith(snapshot);
		expect(fetcher.mock.calls[0]).toEqual([
			'/tools',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'open_model_picker', arguments: {} })
			}
		]);
		await expect(client.call('request_model_switch', { session_id: 'fixture' })).rejects.toThrow(
			'Preview request rejected.'
		);
	} finally {
		await client.close();
	}
});
