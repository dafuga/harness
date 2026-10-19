import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reportLifetimeMs } from './reportRetention';
export async function reportCleanupLog(root: string, result: unknown) {
	const path = join(root, 'retention-history.jsonl');
	const previous = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
		if (error.code !== 'ENOENT') throw error;
		return '';
	});
	const cutoff = Date.now() - reportLifetimeMs;
	const lines = previous.split('\n').filter((line) => {
		try {
			return Date.parse(JSON.parse(line).executedAt) > cutoff;
		} catch {
			return false;
		}
	});
	lines.push(JSON.stringify({ executedAt: new Date().toISOString(), result }));
	await writeFile(path, lines.slice(-300).join('\n') + '\n', { mode: 0o600 });
}
