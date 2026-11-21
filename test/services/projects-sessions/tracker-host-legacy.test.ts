import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import type { TrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const now = () => 1_800_000_000_000;
const itemId = 'abc123def4';
const owner = 'daniel-primary-mbp';
const signal = new AbortController().signal;
const callback = 'http://127.0.0.1:1/completion-fixture';

test('adopts only the matching retained session and delivers its Tracker completion once', () =>
	measureWorkload('repository.projects-sessions-tracker-dispatch', 'legacy-session-adoption', () =>
		withTempDir('hnt-legacy-', proveRetainedSession)
	));

async function proveRetainedSession(root: string) {
	const driver = join(root, 'driver');
	const inventory = join(root, 'inventory');
	writeFileSync(driver, `#!${process.execPath}\n${driverScript}`, { mode: 0o700 });
	const config = legacyConfig(root, driver);
	const database = new DatabaseSync(':memory:');
	const runtime = new TrackerNativeRuntimeService(database, { ...trackerNodeRuntime(config), now });
	const send = vi.fn(
		async (_url: URL, _request: RequestInit) => new Response(null, { status: 204 })
	);
	vi.stubGlobal('fetch', send);
	try {
		seedActiveJob(runtime);
		writeFileSync(inventory, JSON.stringify([{ ...session, tmux: 'auto-abc123-r8' }]));
		await runtime.scheduler!.tick(signal);
		expect(runtime.store.getMeta('harness_dispatch_run:7')).toBeNull();
		writeFileSync(inventory, JSON.stringify([session]));
		await runtime.scheduler!.tick(signal);
		expect(JSON.parse(runtime.store.getMeta('harness_dispatch_run:7') ?? '')).toMatchObject({
			revision: 0,
			hostSessionId: 'retained-pane'
		});
		await verifyLegacyCompletion(runtime, send);
	} finally {
		vi.unstubAllGlobals();
		database.close();
	}
}

function seedActiveJob(runtime: TrackerNativeRuntimeService): void {
	runtime.store.appendLocal({
		itemId,
		fields: {
			title: 'Retained Tracker task',
			project: 'Harness',
			status: 'in_progress',
			kind: 'task',
			callback: JSON.stringify({ url: callback, node: owner }),
			auto: 'retained-token',
			computer: owner
		}
	});
	runtime.store.database
		.prepare(
			`INSERT INTO runs
		(id,item_id,auto_token,rung,cli,model,state,queued_at,started_at,tmux,session_id)
		VALUES (7,?,'retained-token','sol','codex','gpt-6.2-sol','running',?,?,'auto-abc123-r7','legacy-provider-id')`
		)
		.run(itemId, now() - 20_000, now() - 1000);
}

async function verifyLegacyCompletion(
	runtime: TrackerNativeRuntimeService,
	send: ReturnType<typeof vi.fn<(url: URL, request: RequestInit) => Promise<Response>>>
) {
	const response = await runtime.items.handle(
		new Request(`http://tracker-fixture.invalid/items/${itemId}/done`, {
			method: 'POST',
			body: JSON.stringify({ note: 'Fixture verified' })
		})
	);
	expect(response.ok).toBe(true);
	await runtime.scheduler!.tick(signal);
	await runtime.notifications!.tick();
	await runtime.notifications!.tick();
	expect(
		runtime.store.database
			.prepare('SELECT state, outcome, tmux, session_id FROM runs WHERE id = 7')
			.get()
	).toEqual({
		state: 'finished',
		outcome: 'done',
		tmux: session.tmux,
		session_id: 'legacy-provider-id'
	});
	expect(send).toHaveBeenCalledTimes(1);
	const [url, request] = send.mock.calls[0];
	expect(url.href).toBe(callback);
	expect(new Headers(request.headers).get('idempotency-key')).toMatch(/^abc123def4\|.*\|item$/);
	expect(JSON.parse(String(request.body))).toMatchObject({
		events: ['done'],
		item: { id: itemId }
	});
}

function legacyConfig(root: string, driver: string): TrackerNodeConfig {
	const syncSecretFile = join(root, 'wire');
	writeFileSync(syncSecretFile, 'synthetic-legacy-fixture-wire-secret', { mode: 0o600 });
	return {
		version: 1,
		node: owner,
		role: 'hub',
		apiPort: 49281,
		syncPort: 49282,
		database: join(root, 'journal.sqlite'),
		legacyFenceFile: join(root, 'fence'),
		syncSecretFile,
		notifications: {
			targets: { completion: { url: callback } },
			itemCallbacks: ['completion']
		},
		hostEffects: {
			mode: 'active',
			checkpoint: 'fixture-fence',
			launch: { driver, repositories: { Harness: { repo: root, platform: 'linux' } } }
		}
	};
}

const session = {
	itemId: itemId.slice(0, 6),
	key: 'legacy:7',
	id: 'retained-pane',
	tmux: 'auto-abc123-r7',
	legacyRunId: 7,
	state: 'live',
	startedAt: now() - 1200
};

const driverScript = `
const { readFileSync } = require('node:fs');
const { join, dirname } = require('node:path');
if (process.argv[2] !== 'inspect') process.exit(2);
process.stdout.write(readFileSync(join(dirname(process.argv[1]), 'inventory')));
`;
