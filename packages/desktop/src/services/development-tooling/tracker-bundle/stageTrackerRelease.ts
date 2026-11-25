// @harness-uid u_tb6mq4dzfe
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TrackerBundleError } from './TrackerBundleError';
import type { StagedRelease } from './stageTrackerRelease.types';

async function sha256(file: string): Promise<string> {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return hash.digest('hex');
}

async function readIfPresent(file: string): Promise<string | null> {
	try {
		return await readFile(file, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Copies the bundled executable and shim to an immutable, content-named release directory
 * outside the app, so a running service survives the app being replaced. An existing release
 * with the same checksums is reused untouched.
 */
export async function stageTrackerRelease(
	files: { executable: string; shim: string },
	releases: string,
	revision: string
): Promise<StagedRelease> {
	const [executable, shim] = await Promise.all([sha256(files.executable), sha256(files.shim)]);
	const id = createHash('sha256').update(`${executable}:${shim}`).digest('hex').slice(0, 10);
	const directory = join(releases, id);
	const sums = `${executable}  harness\n${shim}  tracker-shim.sh\n`;
	if ((await readIfPresent(join(directory, 'SHA256SUMS'))) === sums) return { id, directory };
	await mkdir(releases, { recursive: true, mode: 0o700 });
	const staging = await mkdtemp(join(releases, `.stage-${id}-`));
	try {
		await copyFile(files.executable, join(staging, 'harness'));
		await copyFile(files.shim, join(staging, 'tracker-shim.sh'));
		await chmod(join(staging, 'harness'), 0o700);
		await chmod(join(staging, 'tracker-shim.sh'), 0o700);
		for (const name of ['BUILD_COMMIT', 'SOURCE_COMMIT'])
			await writeFile(join(staging, name), `${revision}\n`, { mode: 0o600 });
		await writeFile(join(staging, 'SHA256SUMS'), sums, { mode: 0o600 });
		if ((await sha256(join(staging, 'harness'))) !== executable)
			throw new TrackerBundleError('The staged Tracker executable does not match the bundle.');
		await rm(directory, { recursive: true, force: true });
		await rename(staging, directory);
	} finally {
		await rm(staging, { recursive: true, force: true });
	}
	return { id, directory };
}
