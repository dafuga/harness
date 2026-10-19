import { Buffer } from "node:buffer";
import type { Git } from "../../utils/planGit";

/** The width of a full object id in each object format a repository can state. */
const widths: Record<NonNullable<Git['objectFormat']>, number> = { sha1: 40, sha256: 64 };

/**
 * Whether `revision` is a full id in the repository's own object format: what it names never
 * changes. Hexadecimal of another width may be a branch, and with no stated format nothing is.
 */
function immutable(git: Git, revision: string): boolean {
	const width = git.objectFormat ? widths[git.objectFormat] : 0;
	return width > 0 && revision.length === width && /^[0-9a-f]+$/.test(revision);
}

const commit = '^{commit}';

/** Where each plain read of `planGit` names its revision, by command and argument shape. */
const shapes = new Map<string, (rest: string[]) => string | undefined>([
	['show', (rest) => (rest.length === 1 ? rest[0].split(':')[0] : undefined)],
	[
		'ls-tree',
		(rest) => (['-z', '-rz'].includes(rest[0]) && rest[2] === '--' ? rest[1] : undefined)
	],
	[
		'rev-parse',
		(rest) =>
			rest.length === 2 && rest[0] === '--verify' && rest[1].endsWith(commit)
				? rest[1].slice(0, -commit.length)
				: undefined
	],
	[
		'log',
		(rest) =>
			rest[0] === '--format=%H' && rest[1] === '--diff-filter=A' && rest[3] === '--'
				? rest[2]
				: undefined
	]
]);

/** The revision a read is pinned to, when it is one of the plain reads of `planGit`. */
function pinned([command, ...rest]: string[]): string | undefined {
	return shapes.get(command)?.(rest);
}

/**
 * A Git for one planning operation, in which each read pinned to a full object id of the
 * repository's stated object format runs once and is answered again from what it returned.
 * Anything else, HEAD, branches, other widths, writes, input or a read that failed, runs every time. It is made for one operation and dropped with it, so the
 * next operation sees new commits, moved branches and approvals.
 */
export function planReads(git: Git): Git {
	const answers = new Map<string, Promise<Buffer>>();
	const run: Git['run'] = (args, input, env) => {
		const revision = input === undefined && env === undefined ? pinned(args) : undefined;
		if (!revision || !immutable(git, revision)) return git.run(args, input, env);
		const key = JSON.stringify(args);
		const known = answers.get(key);
		if (known) return known.then((bytes) => Buffer.from(bytes));
		const answer = git.run(args);
		answers.set(key, answer);
		answer.catch(() => answers.delete(key));
		return answer.then((bytes) => Buffer.from(bytes));
	};
	return { ...git, run };
}
