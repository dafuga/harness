import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
/** Distinguish separate clones, including hosts with identical names, without copying credentials. */
export async function taskOwner(git: GitAdapter) {
	const common = await git.run(['rev-parse', '--git-common-dir']);
	const path = resolve(git.root, common, 'harness', 'task-owner-id');
	await mkdir(dirname(path), { recursive: true });
	try {
		await writeFile(path, randomUUID(), { flag: 'wx', mode: 0o600 });
	} catch (error) {
		if ((error as { code?: string }).code !== 'EEXIST') throw error;
	}
	const workspace = (await readFile(path, 'utf8')).trim();
	if (!/^[a-f0-9-]{36}$/.test(workspace)) throw new Error('Invalid local task owner identity.');
	const facts = new ProcessIdentityAdapter().find(process.pid);
	if (!facts.startedAt) throw new Error('Cannot establish task owner process identity.');
	return { workspace, pid: process.pid, startedAt: facts.startedAt };
}
