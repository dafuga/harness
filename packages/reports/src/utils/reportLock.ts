import { open, readFile, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
async function recoverDeadLock(path: string) {
	const details = await stat(path).catch(() => undefined);
	if (!details || Date.now() - details.mtimeMs < 5000) return;
	const pid = Number(await readFile(path, 'utf8').catch(() => ''));
	if (!Number.isInteger(pid) || pid < 1) return;
	try {
		process.kill(pid, 0);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') await unlink(path).catch(() => {});
	}
}
export async function reportLock<T>(directory: string, operation: () => Promise<T>): Promise<T> {
	const path = join(directory, '.lock');
	for (let attempt = 0; attempt < 200; attempt++) {
		const handle = await open(path, 'wx', 0o600).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== 'EEXIST') throw error;
			return undefined;
		});
		if (handle) {
			await handle.writeFile(String(process.pid));
			try {
				return await operation();
			} finally {
				await handle.close();
				await unlink(path).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== 'ENOENT') throw error;
				});
			}
		}
		await recoverDeadLock(path);
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error('Report is busy; retry this update');
}
