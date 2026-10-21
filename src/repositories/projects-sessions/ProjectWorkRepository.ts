import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import type { LoopState } from '../../workflows/development-tooling/loop-state/loopState';

export interface Checkout {
	path: string;
	branch: string | null;
	head: string | null;
	primary: boolean;
}
export interface PathChange {
	path: string;
	status: string;
}

const loops = 'specification/loops';
const committed: Record<string, string> = { A: 'added', D: 'removed' };
const plain = ['-c', 'core.quotePath=false'];

/** What the two letters of `git status` say about a path. */
function pending(code: string): string {
	if (code === '??') return 'untracked';
	if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted';
	if (code.includes('D')) return 'removed';
	if (code.includes('R')) return 'renamed';
	return code.includes('A') ? 'added' : 'modified';
}

/** The entries of `git status -z`; a rename is followed by the path it had, which is skipped. */
function listed(output: string): PathChange[] {
	const parts = output.split('\0');
	const found: PathChange[] = [];
	for (let index = 0; index < parts.length; index += 1) {
		const entry = parts[index];
		if (entry.length < 4) continue;
		const code = entry.slice(0, 2);
		found.push({ path: entry.slice(3), status: pending(code) });
		if (/[RC]/.test(code)) index += 1;
	}
	return found;
}

function parsedLoops(texts: Array<string | undefined>): LoopState[] {
	return texts.flatMap((text) => {
		try {
			return text === undefined ? [] : [JSON.parse(text) as LoopState];
		} catch {
			return [];
		}
	});
}

/**
 * Reads from Git what a project is doing: the checkouts of the repository, what commits changed,
 * what is changed in a checkout and not committed, and the tracked loops. Each query is one Git
 * command with a bounded answer, and nothing is written.
 */
export class ProjectWorkRepository {
	private readonly git: GitAdapter;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	/** The checkouts of the repository, the primary one first; outside Git the directory alone. */
	async checkouts(): Promise<Checkout[]> {
		const output = await this.git.attempt(['worktree', 'list', '--porcelain']);
		if (output === undefined) {
			return [{ path: this.root, branch: null, head: null, primary: true }];
		}
		const blocks = output.split('\n\n').map((block) => block.split('\n'));
		return blocks
			.filter((lines) => !lines.some((line) => /^(bare|prunable)/.test(line)))
			.map((lines, index) => {
				const value = (key: string) =>
					lines.find((line) => line.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
				const branch = value('branch')?.replace('refs/heads/', '') ?? null;
				return {
					path: value('worktree') ?? this.root,
					branch,
					head: value('HEAD'),
					primary: !index
				};
			});
	}

	/** What each commit changed against its first parent. */
	async changes(commits: string[]): Promise<Map<string, PathChange[]>> {
		const found = new Map<string, PathChange[]>();
		if (commits.length === 0) return found;
		const shape = ['--no-walk=unsorted', '--first-parent', '-m', '--no-renames', '--name-status'];
		const log = await this.git.run([...plain, 'log', ...shape, '--format=%x1e%H', ...commits]);
		for (const entry of log.split('\x1e').filter(Boolean)) {
			const [commit, ...lines] = entry.split('\n').filter(Boolean);
			const changed = lines.map((line) => {
				const [letter, path] = line.split('\t');
				return { path, status: committed[letter[0]] ?? 'modified' };
			});
			found.set(commit.trim(), changed);
		}
		return found;
	}

	/** What is changed in a checkout and not committed: at most `limit` paths, in path order. */
	async uncommitted(
		checkout: string,
		limit: number
	): Promise<{ changes: PathChange[]; truncated: boolean }> {
		const args = [...plain, 'status', '--porcelain=v1', '-z', '--untracked-files=normal'];
		const output = (await new GitAdapter(checkout).exec(args)).stdout.toString('utf8');
		// What Harness keeps in its cache is its own, not a change of the project.
		const all = listed(output).filter((change) => !change.path.startsWith('.cache/'));
		all.sort((left, right) => left.path.localeCompare(right.path));
		return { changes: all.slice(0, limit), truncated: all.length > limit };
	}

	/** The tracked loops: as Git stores them at a commit, or as the checkout has them now. */
	async loops(commit?: string): Promise<LoopState[]> {
		if (commit) {
			const tree = await this.git.attempt(['ls-tree', '-r', '--name-only', commit, '--', loops]);
			const paths = (tree ?? '').split('\n').filter((path) => path.endsWith('/loop.json'));
			const shown = paths.map((path) => this.git.attempt(['show', `${commit}:${path}`]));
			return parsedLoops(await Promise.all(shown));
		}
		const directory = join(this.root, loops);
		const names = existsSync(directory) ? (await readdir(directory)).sort() : [];
		const read = names.map((name) =>
			readFile(join(directory, name, 'loop.json'), 'utf8').catch(() => undefined)
		);
		return parsedLoops(await Promise.all(read));
	}
}
