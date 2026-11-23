// @harness-uid u_bl6xl2h4a3
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, opendir } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerTranscriptMatches } from './trackerTranscriptPatterns';
import { recordTrackerTranscriptExposure } from './trackerTranscriptExposure';

const windowBytes = 128 * 1024;
const overlapBytes = 1024;
const launchHeaderBytes = 512 * 1024;
const windowsPerTick = 16;
const marker = 'tracker_secret_scan_started';
const transcriptName = /(?:^|[-/])([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.jsonl$/iu;

/** Process bounded windows of new transcript bytes and keep cursors in local Tracker metadata. */
export function trackerTranscriptScan(
	store: TrackerPersistenceService,
	roots: readonly string[],
	now: () => number
) {
	return async (signal: AbortSignal) => {
		const started = Number(store.getMeta(marker) ?? now());
		if (store.getMeta(marker) == null) store.writeMeta({ [marker]: String(started) });
		let remaining = windowsPerTick;
		for (const root of new Set(roots)) {
			for await (const file of transcriptFiles(root)) {
				signal.throwIfAborted();
				if (await scanTranscript(store, file, started, now())) remaining--;
				if (!remaining) return;
			}
		}
	};
}

export async function* transcriptFiles(directory: string, depth = 0): AsyncGenerator<string> {
	if (depth > 4) return;
	try {
		for await (const entry of await opendir(directory)) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) yield* transcriptFiles(path, depth + 1);
			if (entry.isFile() && transcriptName.test(entry.name)) yield path;
		}
	} catch (error) {
		if (!isMissing(error)) throw error;
	}
}

async function scanTranscript(
	store: TrackerPersistenceService,
	path: string,
	started: number,
	now: number
): Promise<boolean> {
	const session = transcriptName.exec(basename(path))?.[1];
	if (!session) return false;
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch((error: unknown) => {
		if (isMissing(error)) return undefined;
		throw error;
	});
	if (!file) return false;
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.mtimeMs < started) return false;
		const identity = createHash('sha256')
			.update(JSON.stringify([path, stat.dev, stat.ino]))
			.digest('hex');
		const key = 'tracker_secret_scan:' + identity;
		const cursor = Number(store.getMeta(key) ?? 0);
		if (cursor && stat.size === cursor) return false;
		const offset = Math.max(0, cursor > stat.size ? 0 : cursor - overlapBytes);
		return await scanWindow(store, file, { session, identity, key, offset }, now);
	} finally {
		await file.close();
	}
}

async function scanWindow(
	store: TrackerPersistenceService,
	file: FileHandle,
	{
		session,
		identity,
		key,
		offset
	}: { session: string; identity: string; key: string; offset: number },
	now: number
): Promise<boolean> {
	const buffer = Buffer.alloc(windowBytes);
	const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
	const head = Buffer.alloc(launchHeaderBytes);
	try {
		await file.read(head, 0, head.length, 0);
		const itemId = launcherItem(head);
		for (const hit of trackerTranscriptMatches(buffer.subarray(0, bytesRead), offset)) {
			recordTrackerTranscriptExposure(store, { ...hit, session, identity, itemId }, now);
		}
		store.writeMeta({ [key]: String(offset + bytesRead) });
	} finally {
		buffer.fill(0);
		head.fill(0);
	}
	return bytesRead > 0;
}

function launcherItem(bytes: Buffer): string | undefined {
	return /Read your brief at [^"\r\n]{1,1024}\/brief\.md and do that work\. Your tracker item is ([a-z0-9]{10})\./u.exec(
		bytes.toString('utf8')
	)?.[1];
}

function isMissing(error: unknown): boolean {
	return (
		error instanceof Error &&
		'code' in error &&
		['ENOENT', 'ELOOP', 'ENOTDIR'].includes(String(error.code))
	);
}
