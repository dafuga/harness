import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Git } from "../../utils/planGit";
import { revision } from "../../utils/planGit";
import { fail } from "../../utils/planData";

const queues = new Map<string, Promise<unknown>>();

export async function planWrite<T>(git: Git, work: () => Promise<T>): Promise<T> {
	const before = queues.get(git.dir) ?? Promise.resolve();
	const next = before
		.catch(() => {})
		.then(async () => {
			const lock = join(git.dir, 'harness-planning.lock');
			try {
				await mkdir(lock);
			} catch {
				return fail('repository-busy', 'Another planning operation holds this repository');
			}
			try {
				git.transactionHead = await revision(git);
				return await work();
			} finally {
				await rm(lock, { recursive: true, force: true });
			}
		});
	queues.set(git.dir, next);
	try {
		return await next;
	} finally {
		if (queues.get(git.dir) === next) queues.delete(git.dir);
	}
}
