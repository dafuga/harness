import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeRuntime } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeRuntime';
import { trackerTranscriptMatches } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerTranscriptPatterns';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const formats = [
	['Google OAuth client secret', 'GOCSPX-' + 'A'.repeat(24)],
	['Google API key', 'AIza' + 'A'.repeat(35)],
	['Stripe API key', 'rk_live_' + 'A'.repeat(24)],
	['Stripe webhook signing secret', 'whsec_' + 'A'.repeat(24)],
	['OpenAI API key', 'sk-proj-' + 'A'.repeat(24)],
	['GitHub token', 'github_pat_' + 'A'.repeat(70)],
	['GitHub token', 'ghp_' + 'A'.repeat(36)],
	['npm token', 'npm_' + 'A'.repeat(36)],
	['AWS access key ID', 'AKIA' + 'A'.repeat(16)],
	['Cloudflare API token', 'CLOUDFLARE_API_TOKEN=' + 'A'.repeat(40)],
	['Twilio credential', 'SK' + 'a'.repeat(32) + ' secret=' + 'b'.repeat(32)],
	['Private key', '-----BEGIN PRIVATE KEY-----\\n' + 'A'.repeat(24)]
];

test.each(formats)('reports a synthetic %s by type and byte only', (type, dummy) => {
	const hits = trackerTranscriptMatches(Buffer.from('😀 ' + dummy), 25);
	expect(hits).toEqual([{ type, byte: 30 }]);
	expect(JSON.stringify(hits).includes(dummy)).toBe(false);
});

test('ignores prefix references, Stripe publishable keys and standalone Twilio identifiers', () => {
	const text = 'GOCSPX-, sk-, ghp_, whsec_, npm_, AKIA, pk_live_' + 'a'.repeat(30);
	expect(trackerTranscriptMatches(Buffer.from(text + ' AC' + 'a'.repeat(32)), 0)).toEqual([]);
});

const awaitingReview = 'awaiting Chief of Staff review';

test('watchdog flags the launched item and reopens a closed rotation on a new hit', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'redacted-transcript-watchdog',
		() => withTempDir('harness-transcript-', proveWatchdog)
	));

async function proveWatchdog(root: string) {
	const database = new DatabaseSync(':memory:');
	const config = transcriptOnlyConfig(root);
	const create = () =>
		new TrackerNativeRuntimeService(database, { ...trackerNodeRuntime(config), now: () => 1 });
	const itemId = 'abc123def4';
	const runtime = create();
	runtime.store.appendLocal({ itemId, fields: { title: 'Fixture', kind: 'task', status: 'open' } });
	const log = join(root, '00000000-0000-0000-0000-000000000001.jsonl');
	const signal = new AbortController().signal;
	const dummy = formats[0][1];
	try {
		expect(await runtime.watchdog!.inspect(null, signal)).toMatchObject({
			available: false,
			sessions: [],
			recovery: []
		});

		writeFileSync(
			log,
			JSON.stringify({ type: 'session_meta', instructions: 'x'.repeat(180_000) }) +
				'\n' +
				JSON.stringify({
					prompt: `Read your brief at /fixture/brief.md and do that work. Your tracker item is ${itemId}.`
				}) +
				'\n'
		);
		await runtime.watchdog!.tick(signal);
		appendFileSync(log, JSON.stringify({ type: 'tool_output', text: dummy }) + '\n');
		const restarted = create();
		await restarted.watchdog!.tick(signal);
		await restarted.watchdog!.tick(signal);
		const response = await restarted.items.handle(
			new Request('http://fixture.invalid/items?status=all')
		);
		const items = await response.json();
		expect(items).toHaveLength(2);
		// The watchdog's asks wait for Chief of Staff; nothing reaches Daniel yet.
		const held = { needs_daniel: false, question: null, review_status: awaitingReview };
		expect(items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: itemId, ...held }),
				expect.objectContaining({
					title: expect.stringContaining('Rotate exposed Google OAuth client secret'),
					...held
				})
			])
		);
		// Test the actual durable operation journal, including Tracker notes and flags.
		expect(JSON.stringify(restarted.store.opsSince(0, 100)).includes(dummy)).toBe(false);
		await assertNewExposureReopens(restarted, { itemId, log, signal, dummy }, items);
	} finally {
		database.close();
	}
}

function transcriptOnlyConfig(root: string) {
	const file = join(root, 'tracker.json');
	const syncSecretFile = join(root, 'sync');
	writeFileSync(syncSecretFile, 'synthetic-tracker-sync-key', { mode: 0o600 });
	writeFileSync(
		file,
		JSON.stringify({
			version: 1,
			node: 'fixture-node',
			role: 'hub',
			apiPort: 49291,
			syncPort: 49292,
			database: join(root, 'journal'),
			syncSecretFile,
			legacyFenceFile: join(root, 'fence'),
			hostEffects: {
				mode: 'active',
				checkpoint: 'fixture',
				watchdog: { transcriptRoots: [root] }
			}
		}),
		{ mode: 0o600 }
	);
	return loadTrackerNodeConfig(file);
}

async function assertNewExposureReopens(
	runtime: TrackerNativeRuntimeService,
	{
		itemId,
		log,
		signal,
		dummy
	}: { itemId: string; log: string; signal: AbortSignal; dummy: string },
	items: { id: string }[]
) {
	const rotation = items.find(({ id }) => id !== itemId)!;
	const target = 'http://fixture.invalid/items/' + rotation.id;
	const alerts = () =>
		runtime.watchdog!.alerts().filter(({ kind }) => kind.startsWith('credential exposure:'));
	expect(alerts()).toHaveLength(1);
	const completed = await runtime.items.handle(
		new Request(target + '/done', { method: 'POST', body: '{"force":true}' })
	);
	expect(completed.ok).toBe(true);
	await runtime.watchdog!.tick(signal);
	const unchanged = await runtime.items.handle(new Request(target));
	expect(await unchanged.json()).toMatchObject({ status: 'done' });
	expect(alerts()).toHaveLength(0);
	const anotherDummy = dummy.replaceAll('A', 'B');
	appendFileSync(log, JSON.stringify({ type: 'tool_output', text: anotherDummy }) + '\n');
	await runtime.watchdog!.tick(signal);
	const reopened = await runtime.items.handle(new Request(target));
	expect(alerts()).toHaveLength(1);
	expect(await reopened.json()).toMatchObject({
		status: 'open',
		needs_daniel: false,
		review_status: awaitingReview
	});
	expect(JSON.stringify(runtime.store.opsSince(0, 100)).includes(anotherDummy)).toBe(false);
}
