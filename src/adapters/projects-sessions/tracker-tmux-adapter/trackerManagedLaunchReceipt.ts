// @harness-uid u_fyf7e7kyi5
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { TrackerHostSession } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';

const receiptSchema = z.strictObject({
	node: z.string(),
	runId: z.int().positive(),
	itemId: z.string().regex(/^[a-z0-9]{6,10}$/),
	key: z.string(),
	token: z.string().regex(/^[a-f0-9]{64}$/),
	tmux: z.string().regex(/^auto-[a-z0-9]{6}-r[0-9]+$/),
	issuedAt: z.int().nonnegative()
});

export function trackerManagedToken(node: string, key: string): string {
	return createHash('sha256')
		.update(JSON.stringify([node, key]))
		.digest('hex');
}

export function checkTrackerManagedReceipt(
	directory: string,
	node: string,
	key: string
): TrackerManagedReceipt | undefined {
	const text = privateRecord(join(directory, 'receipt.json'));
	if (text === undefined) return undefined;
	const record = receiptSchema.parse(JSON.parse(text));
	if (record.node !== node || record.key !== key || record.token !== trackerManagedToken(node, key))
		throw new TypeError('Tracker attempt receipt does not match its reservation');
	return record;
}

export function trackerManagedEvidence(
	directory: string,
	receipt: TrackerManagedReceipt,
	presence: 'live' | 'absent' | 'unknown'
): TrackerHostSession | undefined {
	const phase = privateRecord(join(directory, 'started'))?.trim();
	if (phase !== receipt.token) return undefined;
	const exitCode = managedExitCode(join(directory, 'exit'));
	if (presence === 'unknown' && exitCode === undefined) return undefined;
	let state: TrackerHostSession['state'] = 'exited';
	if (exitCode === undefined) state = presence === 'absent' ? 'lost' : 'live';
	return {
		itemId: receipt.itemId,
		key: receipt.key,
		id: receipt.token,
		tmux: receipt.tmux,
		startedAt: receipt.issuedAt,
		state,
		exitCode
	};
}

function managedExitCode(path: string): number | undefined {
	const exit = privateRecord(path)?.trim();
	if (exit === undefined) return undefined;
	if (!/^\d{1,3}$/.test(exit) || Number(exit) > 255)
		throw new TypeError('Invalid Tracker worker exit receipt');
	return Number(exit);
}

function privateRecord(path: string): string | undefined {
	const fd = openTrackerReceipt(path);
	if (fd === undefined) return undefined;
	try {
		const stat = fstatSync(fd);
		if (
			!stat.isFile() ||
			stat.nlink !== 1 ||
			stat.uid !== process.getuid?.() ||
			(stat.mode & 0o077) !== 0 ||
			stat.size > 8192
		)
			throw new TypeError('Tracker launch receipt must be a private regular file');
		return readFileSync(fd, 'utf8');
	} finally {
		closeSync(fd);
	}
}

function openTrackerReceipt(path: string): number | undefined {
	try {
		return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
		throw error;
	}
}
