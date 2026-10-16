import { createHash } from 'node:crypto';
import type { RepositoryIdentity, SourceEntry, SourceHistoryAdapter } from 'collaboration';

export interface FakeCommit {
	files: Map<string, Uint8Array>;
	parents: string[];
	subject: string;
	author: string;
	committedAt: string;
}

/** One repository as GitHub holds it: commits, refs and the objects of its LFS store. */
export interface FakeGit {
	commits: Map<string, FakeCommit>;
	refs: Map<string, string>;
	lfs: Map<string, Uint8Array>;
	/** Adds a commit under a name that decides its hash, and answers with that hash. */
	commit(label: string, files: Map<string, Uint8Array>, parents?: string[]): string;
	/** The tree of a commit that is held. */
	tree(commit: string): string;
}

const sha1 = (value: string | Uint8Array) => createHash('sha1').update(value).digest('hex');
const pointer = /^version \S+\noid sha256:([0-9a-f]{64})\nsize \d+\n?$/;
const failed = (code: string) => Object.assign(new Error(`GitHub ${code}`), { code });

export function blobId(bytes: Uint8Array): string {
	return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function treeId(commit: FakeCommit): string {
	const listed = [...commit.files].map(([path, bytes]) => `${path}\0${blobId(bytes)}`);
	return sha1(listed.sort().join('\n'));
}

export function fakeGit(): FakeGit {
	const commits = new Map<string, FakeCommit>();
	return {
		commits,
		refs: new Map(),
		lfs: new Map(),
		commit(label, files, parents = []) {
			const id = sha1(`commit ${label}`);
			commits.set(id, {
				files: new Map(files),
				parents,
				subject: `feat: ${label}`,
				author: 'Harness Fixture',
				committedAt: '2026-10-12T08:00:00Z'
			});
			return id;
		},
		tree(commit) {
			const found = commits.get(commit);
			if (!found) throw failed('github-unavailable');
			return treeId(found);
		}
	};
}

function entries(commit: FakeCommit): SourceEntry[] {
	return [...commit.files]
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([path, bytes]) => ({
			path,
			sha: blobId(bytes),
			type: 'blob' as const,
			mode: '100644',
			size: bytes.length
		}));
}

/** True when `commit` is `tip` or one of its ancestors, by any parent. */
function reaches(git: FakeGit, tip: string, commit: string): boolean {
	const seen = new Set<string>();
	const queue = [tip];
	while (queue.length > 0) {
		const next = queue.shift() as string;
		if (next === commit) return true;
		if (seen.has(next)) continue;
		seen.add(next);
		queue.push(...(git.commits.get(next)?.parents ?? []));
	}
	return false;
}

interface Reader {
	git(repository: RepositoryIdentity): FakeGit;
	held(repository: RepositoryIdentity, commit: string): FakeCommit;
	blob(repository: RepositoryIdentity, input: { commit: string; path: string }): Uint8Array;
}

function reader(repositories: Map<number, FakeGit>, calls: string[]): Reader {
	const git = (repository: RepositoryIdentity) => {
		const found = repositories.get(repository.id);
		if (!found) throw failed('repository-denied');
		return found;
	};
	const held = (repository: RepositoryIdentity, commit: string) => {
		const found = git(repository).commits.get(commit);
		if (!found) throw failed('github-unavailable');
		return found;
	};
	return {
		git,
		held,
		blob(repository, input) {
			calls.push(`blob ${input.commit.slice(0, 7)} ${input.path}`);
			const bytes = held(repository, input.commit).files.get(input.path);
			if (!bytes) throw failed('not-found');
			return new Uint8Array(bytes);
		}
	};
}

function history(read: Reader, calls: string[]) {
	return {
		branches: async (repository: RepositoryIdentity) => {
			calls.push('branches');
			return [...read.git(repository).refs]
				.filter(([ref]) => ref.startsWith('refs/heads/'))
				.map(([ref, tip]) => ({ name: ref.slice('refs/heads/'.length), tip }));
		},
		commits: async () => [],
		changed: async () => [],
		optionalRef: async (repository: RepositoryIdentity, ref: string) => {
			calls.push(`ref ${ref}`);
			const commit = read.git(repository).refs.get(ref);
			return commit ? { commit, tree: treeId(read.held(repository, commit)) } : null;
		},
		facts: async (repository: RepositoryIdentity, commit: string) => {
			calls.push(`facts ${commit.slice(0, 7)}`);
			const found = read.git(repository).commits.get(commit);
			if (!found) return null;
			const { parents, subject, author, committedAt } = found;
			return { commit, tree: treeId(found), parents, subject, author, committedAt };
		},
		reaches: async (repository: RepositoryIdentity, input: { tip: string; commit: string }) => {
			calls.push(`reaches ${input.tip.slice(0, 7)} ${input.commit.slice(0, 7)}`);
			return reaches(read.git(repository), input.tip, input.commit);
		}
	};
}

/**
 * GitHub as the hub reads it, over repositories held in memory. `calls` lists every read that
 * was asked of it, so a test can show that none was made, or that no object was read again.
 */
export function gitSource(repositories: Map<number, FakeGit>) {
	const calls: string[] = [];
	const read = reader(repositories, calls);
	const source: SourceHistoryAdapter = {
		resolve: async (repository, ref) => {
			calls.push(`resolve ${ref.slice(0, 7)}`);
			const commit = /^[a-f0-9]{40}$/.test(ref) ? ref : read.git(repository).refs.get(ref);
			if (!commit) throw failed('not-found');
			return { commit, tree: treeId(read.held(repository, commit)) };
		},
		tree: async (repository, commit) => {
			calls.push(`tree ${commit.slice(0, 7)}`);
			return entries(read.held(repository, commit));
		},
		raw: async (repository, input) => read.blob(repository, input),
		read: async (repository, input) => {
			const bytes = read.blob(repository, input);
			const oid = pointer.exec(new TextDecoder().decode(bytes))?.[1];
			if (!oid) return bytes;
			const object = read.git(repository).lfs.get(oid);
			if (!object) throw failed('lfs-unavailable');
			return new Uint8Array(object);
		},
		validateAnchor: async () => {},
		...history(read, calls)
	};
	return { source, calls };
}
