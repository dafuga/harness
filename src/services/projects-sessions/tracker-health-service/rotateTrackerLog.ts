// @harness-uid u_agbjp3vsgt
import { chmodSync, copyFileSync, lstatSync, truncateSync } from 'node:fs';

export const trackerLogLimit = 5 * 1024 * 1024;

/**
 * Copy to `<log>.1`, then truncate. The service manager keeps the log open for
 * appending, so renaming it would leave the writer on the old file.
 */
export function rotateTrackerLog(path: string, limit: number = trackerLogLimit): boolean {
	try {
		const stat = lstatSync(path);
		if (!stat.isFile() || stat.size <= limit) return false;
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
		throw error;
	}
	copyFileSync(path, path + '.1');
	chmodSync(path + '.1', 0o600);
	truncateSync(path, 0);
	return true;
}
