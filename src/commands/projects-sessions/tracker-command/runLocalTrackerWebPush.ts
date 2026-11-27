// @harness-uid u_xpp5e7jtlu
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
	hubOriginSchema,
	readPushState,
	readWebPushConfig,
	webPushPaths,
	writePrivateJsonFile
} from '../../../services/projects-sessions/tracker-web-push-service/webPushFiles';
import { generateWebPushKeys } from '../../../services/projects-sessions/tracker-web-push-service/webPushTokens';
import type { TrackerNodeConfig } from '../../../services/projects-sessions/tracker-node-service/trackerNodeConfig.types';

const usage = 'usage: tracker web-push setup --origin https://<hub> [--rotate] | status';

/** Runs in this process: the key file is local and the running service picks it up itself. */
export function runLocalTrackerWebPush(args: string[], config: TrackerNodeConfig): number {
	try {
		const { values, positionals } = parseArgs({
			args,
			allowPositionals: true,
			options: {
				origin: { type: 'string' },
				rotate: { type: 'boolean' },
				json: { type: 'boolean' }
			}
		});
		const [mode, ...rest] = positionals;
		if (rest.length) throw new TypeError(usage);
		if (config.role !== 'hub')
			throw new TypeError('browser notifications are sent by the Tracker hub; run this there');
		if (mode === 'setup') return setup(config.database, values);
		if (mode === 'status') return status(config.database, Boolean(values.json));
		throw new TypeError(usage);
	} catch (error) {
		console.error(`tracker: ${error instanceof Error ? error.message : 'web-push failed'}`);
		return 1;
	}
}

/** Writes the key file once and prints only the public key, which the Hub needs. */
function setup(database: string, { origin, rotate }: { origin?: string; rotate?: boolean }) {
	const paths = webPushPaths(database);
	const current = !rotate && existsSync(paths.config) ? readWebPushConfig(paths.config) : null;
	if (current) {
		if (origin && origin !== current.hubOrigin)
			throw new TypeError(`already set up for ${current.hubOrigin}; --rotate replaces the key`);
		printSetup(current.publicKey, current.hubOrigin);
		return 0;
	}
	const hubOrigin = hubOriginSchema.safeParse(origin);
	if (!hubOrigin.success) throw new TypeError(usage);
	const keys = generateWebPushKeys();
	writePrivateJsonFile(paths.config, { version: 1, hubOrigin: hubOrigin.data, ...keys });
	printSetup(keys.publicKey, hubOrigin.data);
	return 0;
}

function printSetup(publicKey: string, hubOrigin: string) {
	console.log(`web push is set up for ${hubOrigin}`);
	console.log(`public key (set as HARNESS_PUSH_PUBLIC_KEY on the Hub): ${publicKey}`);
}

function status(database: string, json: boolean) {
	const paths = webPushPaths(database);
	const config = readWebPushConfig(paths.config);
	const state = readPushState(paths.state);
	const time = (value: number | null) => (value ? new Date(value).toISOString() : null);
	const report = {
		set_up: Boolean(config),
		hub: config?.hubOrigin ?? null,
		public_key: config?.publicKey ?? null,
		announced_asks: state.sent.length,
		last_sent_at: time(state.lastSentAt),
		held_until: time(state.holdUntil),
		failures: state.failures,
		last_problem: state.lastError
	};
	if (json) console.log(JSON.stringify(report, null, 2));
	else
		for (const [name, value] of Object.entries(report)) console.log(`${name}: ${value ?? 'none'}`);
	return 0;
}
