// @harness-uid u_fyf7e7kyi5
import { lstatSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerWorkerClient } from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';

/** Give the host worker a loopback client address without sharing the daemon configuration. */
export function trackerWorkerClient(directory: string, address: TrackerWorkerClient): string {
	const { node, role, apiPort, syncPort } = address;
	const path = join(directory, 'tracker-client.json');
	const config = {
		version: 1,
		node,
		role,
		apiPort,
		// The client validates these absolute paths but has no reason to open them.
		database: join(directory, 'unavailable-database'),
		legacyFenceFile: join(directory, 'unavailable-fence'),
		syncSecretFile: join(directory, 'unavailable-secret'),
		...(role === 'hub' ? { syncPort } : { upstream: { url: 'http://127.0.0.1:1' } })
	};
	writeFileSync(path, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
	return path;
}

export function trackerGuestAuthFile(
	directory: string,
	{ itemId, runId }: { itemId: string; runId: number },
	address: Pick<TrackerWorkerClient, 'writeGuestAuth' | 'apiPort'>
): string | undefined {
	const { writeGuestAuth, apiPort } = address;
	if (!writeGuestAuth) return undefined;
	const path = join(directory, 'guest-auth.json');
	writeGuestAuth({ path, itemId, runId, apiPort });
	const file = lstatSync(path);
	if (
		!file.isFile() ||
		file.uid !== process.getuid?.() ||
		file.nlink !== 1 ||
		(file.mode & 0o077) !== 0
	)
		throw new TypeError(
			'Tracker Docker guest auth file must be private and owned by the service user'
		);
	return path;
}
