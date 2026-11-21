// @harness-uid u_rw64iex44n
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { z } from 'zod';
import { ModuleTaskRunError } from './ModuleTaskRunError';
import { trackerGuestItemId, trackerGuestRunId } from './dockerTrackerGuestProtocol';
import type { TrackerGuestGrant } from './dockerTrackerGuest.types';

const grantSchema = z.strictObject({
	itemId: trackerGuestItemId,
	runId: trackerGuestRunId,
	apiPort: z.number().int().min(1).max(65_535),
	key: z.string().regex(/^[a-f0-9]{64}$/)
});

export async function dockerTrackerGuestGrant(
	cwd: string,
	assignedItem?: string
): Promise<TrackerGuestGrant | undefined> {
	const path = process.env.HARNESS_TRACKER_GUEST_AUTH_FILE;
	if (path === undefined) return undefined;
	try {
		if (!isAbsolute(path)) throw new TypeError('Invalid managed Docker Tracker grant');
		const location = relative(await realpath(cwd), await realpath(path));
		if (!location.startsWith('..' + sep) && !isAbsolute(location))
			throw new TypeError('Invalid managed Docker Tracker grant');
		const grant = grantSchema.parse(JSON.parse(await readPrivateGrant(path)));
		if (
			grant.itemId !== process.env.TRACKER_ITEM_ID ||
			String(grant.runId) !== process.env.TRACKER_RUN_ID ||
			(assignedItem && assignedItem !== grant.itemId)
		)
			throw new TypeError('Invalid managed Docker Tracker grant');
		return { ...grant, key: Buffer.from(grant.key, 'hex') };
	} catch {
		throw new ModuleTaskRunError(
			'Managed Docker Tracker grant is invalid or outside its assigned run.'
		);
	}
}

async function readPrivateGrant(path: string): Promise<string> {
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const info = await file.stat();
		if (
			!info.isFile() ||
			info.size > 1024 ||
			info.uid !== process.getuid?.() ||
			(info.mode & 0o077) !== 0 ||
			info.nlink !== 1
		)
			throw new TypeError('Invalid managed Docker Tracker grant');
		const bytes = Buffer.alloc(1025);
		const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
		if (bytesRead > 1024) throw new TypeError('Invalid managed Docker Tracker grant');
		return bytes.subarray(0, bytesRead).toString('utf8');
	} finally {
		await file.close();
	}
}
