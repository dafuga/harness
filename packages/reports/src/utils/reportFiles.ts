import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
export function reportFiles(root?: string) {
	return root || process.env.PROJECT_REPORTS_HOME || join(homedir(), '.codex', 'project-reports');
}
export function safeId(id: string) {
	if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Invalid report or asset ID');
	return id;
}
export async function readJson<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}
export async function atomicJson(path: string, data: unknown) {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	const temp = `${path}.${randomUUID()}.tmp`;
	await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
	await rename(temp, path);
}
