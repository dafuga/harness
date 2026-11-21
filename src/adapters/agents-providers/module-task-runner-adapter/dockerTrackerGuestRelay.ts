// @harness-uid u_rw64iex44n
import { once } from 'node:events';
import {
	maxRelayPayloadBytes,
	readFrames,
	writeFramePayload
} from '../../../../scripts/tracker-docker-relay/frames.mjs';
import type { TaskChild } from './taskProcess.types';
import type { TrackerGuestGrant } from './dockerTrackerGuest.types';
import { TrackerSyncAuthService } from '../../../services/networking-security/TrackerSyncAuthService';
import { ModuleTaskRunError } from './ModuleTaskRunError';
import { scopedTrackerGuestRequest, trackerGuestPath } from './dockerTrackerGuestProtocol';
import { killGroup } from './taskProcessMonitor';

/** Stderr carries requests from the guest wrapper. Provider stdout stays untouched. */
export async function relayDockerTrackerGuest(
	child: TaskChild,
	grant: TrackerGuestGrant,
	prompt: string,
	signal: AbortSignal
): Promise<void> {
	const controller = new AbortController();
	const closed = once(child, 'close').finally(() => controller.abort());
	void closed.catch(() => {});
	const lifetime = AbortSignal.any([controller.signal, signal]);
	const auth = new TrackerSyncAuthService(grant.key);
	try {
		await writeFramePayload(child.stdin, prompt);
		let count = 0;
		for await (const frame of readFrames(child.stderr)) {
			if (++count > 256) throw new RangeError('Tracker request limit reached');
			const reply = await trackerGuestReply(frame, grant, auth, lifetime);
			await writeFramePayload(child.stdin, reply);
		}
	} catch {
		if (!lifetime.aborted) {
			killGroup(child);
			throw new ModuleTaskRunError('Managed Docker Tracker relay interrupted.');
		}
	} finally {
		child.stdin.end();
		await closed.catch(() => {});
	}
}

async function trackerGuestReply(
	frame: string,
	grant: TrackerGuestGrant,
	auth: TrackerSyncAuthService,
	signal: AbortSignal
): Promise<string> {
	let body: string;
	try {
		const request = scopedTrackerGuestRequest(frame, grant);
		if (!request) return relayError(403, 'command is outside the assigned Tracker item and run');
		body = JSON.stringify(request);
	} catch {
		return relayError(400, 'invalid Tracker command frame');
	}
	try {
		const method = 'POST';
		const response = await fetch(`http://127.0.0.1:${grant.apiPort}${trackerGuestPath}`, {
			method,
			body,
			headers: {
				'content-type': 'application/json',
				authorization: auth.authorizationHeader({ method, pathAndQuery: trackerGuestPath, body })
			},
			redirect: 'error',
			signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)])
		});
		return JSON.stringify([response.status, await boundedReply(response)]);
	} catch {
		return relayError(503, 'host Tracker service unavailable');
	}
}

async function boundedReply(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) throw new TypeError('Tracker response has no body');
	try {
		let size = 0;
		const chunks: Uint8Array[] = [];
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
			size += chunk.value.byteLength;
			if (size > maxRelayPayloadBytes - 32)
				throw new RangeError('Tracker response exceeds relay limit');
			chunks.push(chunk.value);
		}
		return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

function relayError(status: number, error: string): string {
	return JSON.stringify([status, { error }]);
}
