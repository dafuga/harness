import { execFileSync } from 'node:child_process';
import { expect, vi } from 'vitest';
import type { Explanation } from '../../src/core/explanationTypes';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { measureWorkload } from './measureWorkload';

const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=f@harness.invalid'];
const git = (root: string, args: string[], input?: string) =>
	String(
		execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], { cwd: root, input })
	).trim();

/** The existing note case also reads a large, real Git note set and a pinned earlier version. */
export async function assertHistoryNoteBatches(
	root: string,
	explanation: Explanation
): Promise<void> {
	const commits = noteCommits(root);
	seedNotes(root, commits, explanation);
	const pinned = git(root, ['rev-parse', 'refs/notes/harness']);
	const repository = new HistoryNoteRepository(root);
	const calls = vi.spyOn(GitAdapter.prototype, 'bytes');
	try {
		const initial = await measureWorkload('repository.history-note', 'many-committed-notes', () =>
			repository.all()
		);
		expect(initial.size).toBe(commits.length);
		for (const commit of commits) expect(initial.get(commit)?.entries).toHaveLength(1);
		expect(initial.get(commits[0])?.problems).toEqual(['note line 2 is not a valid history entry']);
		expect(initial.get(commits[1])?.problems[0]).toContain('was written for commit');
		const updated = { ...explanation, behavior: 'Keeps the newer note too.' };
		await repository.append(commits[2], [
			{ schemaVersion: 1, kind: 'reason', commit: commits[2], explanation: updated }
		]);
		expect(await repository.all(pinned)).toEqual(initial);
		expect((await repository.all()).get(commits[2])?.entries).toHaveLength(2);
		expect(await repository.all(null)).toEqual(new Map());
		const batches = calls.mock.calls
			.filter(([args]) => args[0] === 'cat-file' && args[1] === '--batch')
			.map(
				([, options]) =>
					String(options?.input ?? '')
						.trim()
						.split('\n').length
			);
		expect(batches.length).toBeGreaterThan(1);
		expect(
			Math.max(...batches),
			'a note payload batch must contain at most 64 blobs'
		).toBeLessThanOrEqual(64);
	} finally {
		calls.mockRestore();
	}
}

function noteCommits(root: string): string[] {
	const tree = git(root, ['rev-parse', 'HEAD^{tree}']);
	const parent = git(root, ['rev-parse', 'HEAD']);
	return Array.from({ length: 130 }, (_, index) =>
		git(root, ['commit-tree', tree, '-p', parent, '-m', `fixture note ${index}`])
	);
}

function seedNotes(root: string, commits: string[], explanation: Explanation): void {
	const blobs = commits.map((commit, index) => {
		const valid = JSON.stringify({ schemaVersion: 1, kind: 'reason', commit, explanation }) + '\n';
		const copied =
			JSON.stringify({ schemaVersion: 1, kind: 'reason', commit: commits[0], explanation }) + '\n';
		let extra = '';
		if (index === 0) extra = 'invalid json\n';
		else if (index === 1) extra = copied;
		const text = valid + extra;
		return `blob\nmark :${index + 1}\ndata ${Buffer.byteLength(text)}\n${text}\n`;
	});
	const files = commits.map((commit, index) => `M 100644 :${index + 1} ${commit}\n`);
	const message = 'fixture notes';
	const revision = `commit refs/notes/harness\ncommitter Fixture <f@harness.invalid> 1700000000 +0000\ndata ${message.length}\n${message}\n`;
	git(root, ['fast-import', '--quiet'], blobs.join('') + revision + files.join('') + '\n');
}
