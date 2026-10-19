import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export async function gitRead(root: string, args: string[]): Promise<string> {
	const result = await run('git', ['-C', root, ...args], {
		maxBuffer: 64000000,
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
	});
	return result.stdout;
}
export async function gitRevision(root: string, revision = 'HEAD'): Promise<string> {
	if (!revision || revision.includes('\0') || revision.length > 300)
		throw new Error('Invalid revision.');
	return (
		await gitRead(root, ['rev-parse', '--verify', '--end-of-options', revision + '^{commit}'])
	).trim();
}
export async function gitFiles(root: string, revision: string): Promise<string[]> {
	return (await gitRead(root, ['ls-tree', '-rz', '--name-only', await gitRevision(root, revision)]))
		.split('\0')
		.filter(Boolean);
}
export async function gitText(root: string, revision: string, path: string): Promise<string> {
	if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\0'))
		throw new Error('Unsafe source path.');
	const data = await gitRead(root, ['show', (await gitRevision(root, revision)) + ':' + path]);
	if (Buffer.byteLength(data) > 2000000) throw new Error('Source file too large.');
	return data;
}
