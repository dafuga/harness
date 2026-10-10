import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from './cli';
import { repoAt, type VerifyRepo } from './verifyRepo';

export const evidenceRef = 'refs/heads/harness-evidence';
export const notesRef = 'refs/notes/harness';

export interface NoteLine {
	kind: string;
	record?: string;
	status?: string;
	id?: string;
	source?: { commit: string; tree: string; base: string | null };
	evidence?: { commit: string; path: string; manifest: string };
	explanation?: { unit: string; symbol: string };
}

export interface Attached {
	record: string;
	status: string;
	source: string;
	evidence: { commit: string; path: string; manifest: string };
	note: string;
	archive: string;
	created: boolean;
}

export interface HistoryStatus {
	commit: string;
	verified: boolean;
	records: Array<{ record: string; status: string; valid: boolean; problems: string[] }>;
	problems: string[];
}

export const sha256 = (bytes: Buffer | string): string =>
	createHash('sha256').update(bytes).digest('hex');

/** Runs a history or hooks command with --json and parses what it printed. */
export async function harnessJson<T>(repo: VerifyRepo, args: string[], env = {}): Promise<T> {
	const result = await repo.run([...args, '--json'], env);
	if (result.exitCode !== 0) throw new Error(`${args.join(' ')} failed: ${result.stderr}`);
	return JSON.parse(result.stdout) as T;
}

export const attach = (repo: VerifyRepo, args: string[] = []): Promise<Attached> =>
	harnessJson<Attached>(repo, ['history', 'attach', ...args]);

export const statusOf = (repo: VerifyRepo, commit = 'HEAD'): Promise<HistoryStatus> =>
	harnessJson<HistoryStatus>(repo, ['history', 'status', '--commit', commit]);

export async function noteLines(repo: VerifyRepo, commit = 'HEAD'): Promise<NoteLine[]> {
	const text = await repo.git(['notes', '--ref=harness', 'show', commit]);
	return text
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as NoteLine);
}

/** A bare repository that `repo` knows as origin and has pushed its branch to. */
export async function withRemote(repo: VerifyRepo): Promise<string> {
	const parent = await mkdtemp(join(tmpdir(), 'harness-remote-'));
	const remote = join(parent, 'origin.git');
	await runCommand(['git', 'init', '-q', '--bare', '-b', 'main', remote], parent);
	await repo.git(['remote', 'add', 'origin', remote]);
	await repo.git(['push', '-q', 'origin', 'main']);
	return remote;
}

/** A plain `git clone`: no scratch cache, no local evidence, no media objects. */
export async function freshClone(remote: string): Promise<VerifyRepo> {
	const parent = await mkdtemp(join(tmpdir(), 'harness-clone-'));
	await runCommand(['git', 'clone', '-q', remote, join(parent, 'demo')], parent);
	return repoAt(join(parent, 'demo'));
}

export function lfsObjectPath(root: string, oid: string): string {
	return join(root, '.git/lfs/objects', oid.slice(0, 2), oid.slice(2, 4), oid);
}

/** One digest over every file below a directory, by relative path and content. */
export async function directoryDigest(directory: string, prefix = ''): Promise<string> {
	const hash = createHash('sha256');
	const walk = async (relative: string): Promise<void> => {
		const entries = await readdir(join(directory, relative), { withFileTypes: true });
		for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : 1))) {
			const path = relative ? `${relative}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(path);
			else hash.update(`${path}\0${sha256(await readFile(join(directory, path)))}\n`);
		}
	};
	if (existsSync(join(directory, prefix))) await walk(prefix);
	return hash.digest('hex');
}

export const removeRemote = (remote: string): Promise<void> =>
	rm(join(remote, '..'), { recursive: true, force: true });
