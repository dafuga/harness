import { DatabaseSync } from 'node:sqlite';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, onTestFinished } from 'vitest';
import { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { trackerNodeApi } from '../../src/services/projects-sessions/tracker-node-service/trackerNodeListeners';
import { TrackerSupervisorService } from '../../src/services/projects-sessions/TrackerSupervisorService';
import { publishApprovedReviews } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerChiefReviewQueue';
import { generateWebPushKeys } from '../../src/services/projects-sessions/tracker-web-push-service/webPushTokens';
import { createTempDirectory } from './temporary';
import { webPushWorld, hubOrigin } from './trackerWebPushWorld';

const node = 'daniel-primary-mbp';

async function callTracker(
	runtime: TrackerNativeRuntimeService,
	route: string,
	body: unknown,
	actor: string
) {
	const request = new Request(`http://127.0.0.1:7700/native/v1${route}`, {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'content-type': 'application/json',
			'x-tracker-as': actor,
			'x-harness-tracker-node': node,
			'x-harness-tracker-role': 'hub'
		}
	});
	const supervisor = new TrackerSupervisorService(runtime);
	const response = await trackerNodeApi(request, runtime, supervisor, 'fixture');
	const data = await response.json();
	expect(response.ok, JSON.stringify(data)).toBe(true);
	return data as { id: string };
}

/** A real file-backed Tracker hub node whose Hub and push services are synthetic. */
export async function trackerWebPushFixture() {
	const root = await createTempDirectory('tracker-web-push-');
	const path = join(root, 'tracker.db');
	const database = new DatabaseSync(path);
	onTestFinished(() => database.close());
	let clock = Date.parse('2026-11-26T12:00:00Z');
	const keys = generateWebPushKeys();
	const { world, fetch } = webPushWorld(keys.publicKey);
	const runtime = new TrackerNativeRuntimeService(database, {
		node,
		role: 'hub',
		now: () => clock,
		webPush: { database: path, fetch }
	});
	const api = (route: string, body: unknown, actor = 'Chief of Staff') =>
		callTracker(runtime, route, body, actor);
	const item = async (
		fields: Record<string, unknown>,
		question: string,
		options?: unknown,
		actor?: string
	) => {
		const { id } = await api('/items', { agent: 'harbor', ...fields });
		await api(`/items/${id}/flag`, { question, options }, actor);
		return id;
	};
	return {
		root,
		world,
		runtime,
		api,
		configure() {
			const file = join(root, 'web-push.json');
			const config = { version: 1, hubOrigin, ...keys };
			writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
			chmodSync(file, 0o600);
		},
		ask: (title: string, question: string, extra: Record<string, unknown> = {}, actor?: string) =>
			item(
				{ title, ...extra },
				question,
				[{ label: 'Yes', recommended: true }, { label: 'No' }],
				actor
			),
		/** A flag without choices: a dependency block for Chief of Staff, never a decision. */
		dependency: (title: string) => item({ title }, 'FOR CoS: waiting on the box'),
		advance(ms: number) {
			clock += ms;
		},
		at(time: string) {
			clock = Date.parse(time);
		},
		tick: () => publishAndPush(runtime, clock)
	};
}

/** What one hub pass does: publish what waited overnight, then push. */
function publishAndPush(runtime: TrackerNativeRuntimeService, clock: number) {
	publishApprovedReviews(runtime.store, clock);
	return runtime.webPush!.tick();
}
