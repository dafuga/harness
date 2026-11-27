// @harness-uid u_2rj3usmtc3
import { chmodSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { readPrivateJson } from '../tracker-node-service/trackerNodeConfig';
import { emptyPushState } from './planNeedsYouPush';
import type { PushState, WebPushConfig } from './webPush.types';

/** Both files live beside the journal, so a rehearsal or test node never finds the live key. */
export function webPushPaths(database: string) {
	const directory = dirname(database);
	return {
		config: join(directory, 'web-push.json'),
		state: join(directory, 'web-push-state.json')
	};
}

/** The public Hub: HTTPS only, so subscriptions never travel in the clear. */
export const hubOriginSchema = z.string().refine((value) => {
	if (!URL.canParse(value)) return false;
	const url = new URL(value);
	return url.protocol === 'https:' && url.origin === value;
});

const configSchema = z.strictObject({
	version: z.literal(1),
	hubOrigin: hubOriginSchema,
	publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
	privateKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/)
});

const stateSchema = z.object({
	sent: z.array(z.string()),
	lastSentAt: z.number().nullable(),
	holdUntil: z.number().nullable(),
	failures: z.number(),
	lastError: z.string().nullable()
});

const missing = (error: unknown) =>
	error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** Null until `tracker web-push setup` has run. A bad or readable-by-others file throws. */
export function readWebPushConfig(path: string): WebPushConfig | null {
	let value: unknown;
	try {
		value = readPrivateJson(path);
	} catch (error) {
		if (missing(error)) return null;
		throw new TypeError('Invalid or unreadable web-push.json');
	}
	const parsed = configSchema.safeParse(value);
	// The parser's own report could repeat the key, so it is never passed on.
	if (!parsed.success) throw new TypeError('Invalid or unreadable web-push.json');
	return parsed.data;
}

/** A lost or damaged state announces once more; it never silences an open ask. */
export function readPushState(path: string): PushState {
	try {
		return stateSchema.parse(readPrivateJson(path));
	} catch {
		return emptyPushState();
	}
}

export function writePrivateJsonFile(path: string, value: object): void {
	const temporary = `${path}.${process.pid}.tmp`;
	writeFileSync(temporary, JSON.stringify(value, null, '\t') + '\n', { mode: 0o600 });
	chmodSync(temporary, 0o600);
	renameSync(temporary, path);
}
