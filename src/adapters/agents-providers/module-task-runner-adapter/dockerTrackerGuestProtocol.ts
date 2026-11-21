// @harness-uid u_rw64iex44n
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import type {
	TrackerGuestGrant,
	TrackerGuestIdentity,
	TrackerGuestRequest
} from './dockerTrackerGuest.types';

export const trackerGuestPath = '/native/guest/v1';
export const trackerGuestItemId = z.string().regex(/^[a-z0-9]{6,32}$/);
export const trackerGuestRunId = z.number().int().positive().safe();
const action = z.enum(['start', 'show', 'note', 'progress', 'flag', 'block', 'done']);
const textActions = new Set(['note', 'progress', 'flag', 'block']);
const text = z
	.string()
	.refine((value) => Buffer.byteLength(value) <= 2000)
	.nullable();

export const trackerGuestRequestSchema = z
	.tuple([trackerGuestItemId, trackerGuestRunId, action, text])
	.refine(([, , verb, value]) => {
		if (textActions.has(verb)) return Boolean(value?.trim());
		return verb === 'done' || value === null;
	});

const command = z.tuple([trackerGuestItemId, action, text]);

export function scopedTrackerGuestRequest(
	frame: string,
	scope: Pick<TrackerGuestGrant, 'itemId' | 'runId'>
): TrackerGuestRequest | undefined {
	const request = command.safeParse(JSON.parse(frame));
	if (!request.success) return undefined;
	const { itemId, runId } = scope;
	const [id, verb, value] = request.data;
	if (!itemId.startsWith(id)) return undefined;
	const parsed = trackerGuestRequestSchema.safeParse([itemId, runId, verb, value]);
	return parsed.success ? parsed.data : undefined;
}

/** Use a domain-separated key confined to a single local run and item. */
export function deriveTrackerGuestKey(
	secret: string | Uint8Array,
	identity: TrackerGuestIdentity
): Buffer {
	const { node, itemId, runId, attemptKey } = identity;
	return createHmac('sha256', secret)
		.update(JSON.stringify(['harness-tracker-guest/v1', node, itemId, runId, attemptKey]))
		.digest();
}
