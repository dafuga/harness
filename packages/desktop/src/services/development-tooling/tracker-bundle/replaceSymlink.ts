// @harness-uid u_tb7nr5eqgf
import { lstat, mkdir, readlink, rename, symlink } from 'node:fs/promises';
import { dirname } from 'node:path';

/** What a path holds right now: nothing, a link (with its target) or something else. */
export async function inspectLink(
	path: string
): Promise<{ kind: 'absent' } | { kind: 'link'; target: string } | { kind: 'other' }> {
	try {
		const info = await lstat(path);
		return info.isSymbolicLink()
			? { kind: 'link', target: await readlink(path) }
			: { kind: 'other' };
	} catch {
		return { kind: 'absent' };
	}
}

/** Points `path` at `target` in one atomic rename, so no reader ever sees it missing. */
export async function replaceSymlink(path: string, target: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${process.pid}.tmp`;
	await symlink(target, temporary);
	await rename(temporary, path);
}
