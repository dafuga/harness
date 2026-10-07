import { access, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { projectIdentity } from './analyticsRecord';

const execute = promisify(execFile);

export async function sessionProject(cwd: string, roots: string[]): Promise<string | undefined> {
	let directory = await realpath(cwd);
	const boundary = await gitRoot(directory);
	while (true) {
		if (await exists(join(directory, 'harness.audit.json'))) {
			const identity = await projectIdentity(directory);
			const allowed = await Promise.all(roots.map((root) => realpath(root)));
			return allowed.some((root) => contains(root, identity)) ? directory : undefined;
		}
		const parent = dirname(directory);
		if (parent === directory || directory === boundary) return undefined;
		directory = parent;
	}
}

function contains(root: string, path: string): boolean {
	const child = relative(root, path);
	return !isAbsolute(child) && child !== '..' && !child.startsWith('../');
}

async function gitRoot(cwd: string): Promise<string | undefined> {
	try {
		const { stdout } = await execute('git', ['rev-parse', '--show-toplevel'], { cwd });
		return await realpath(stdout.trim());
	} catch {
		return undefined;
	}
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
