/** Chooses the commit that the shrink-only debt ratchets compare the working tree against. */

import type { GitRead, RatchetBase } from './debt-ratchet-base.types';
export type { GitRead, RatchetBase } from './debt-ratchet-base.types';

/** A ref or commit that replaces the protected-branch lookup, e.g. a push's previous tip. */
export const ratchetBaseVariable = 'HARNESS_DEBT_RATCHET_BASE';

const protectedRefs = ['origin/main', 'main'];

function read(git: GitRead, args: readonly string[]): string | null {
	try {
		return git(args).trim() || null;
	} catch {
		return null;
	}
}

function commitOf(git: GitRead, ref: string): string | null {
	return read(git, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
}

/**
 * Order: the override, then the merge-base with the pull request base, `origin/main` and
 * `main`. A merge-base covers every commit of a branch, not only its last one. HEAD that is
 * already on the protected branch falls back to its first parent; nothing usable returns null.
 */
export function selectRatchetBase(
	git: GitRead,
	env: Readonly<Record<string, string | undefined>>
): RatchetBase {
	const head = commitOf(git, 'HEAD');
	if (!head) return { commit: null, message: 'No HEAD commit: debt ratchets have no base.' };
	const notes: string[] = [];
	const override = env[ratchetBaseVariable]?.trim();
	// A push that creates a branch reports an all-zero previous commit.
	if (override && !/^0+$/.test(override)) {
		const commit = commitOf(git, override);
		if (commit) {
			const shared = read(git, ['merge-base', commit, head]) ?? commit;
			return { commit: shared, message: `Ratchet base: ${ratchetBaseVariable}=${override}.` };
		}
		notes.push(`${ratchetBaseVariable}=${override} is not a commit in this checkout.`);
	}
	const pullRequestBase = env.GITHUB_BASE_REF?.trim();
	const candidates = [...(pullRequestBase ? [`origin/${pullRequestBase}`] : []), ...protectedRefs];
	for (const candidate of new Set(candidates)) {
		const tip = commitOf(git, candidate);
		if (!tip) {
			notes.push(`${candidate} does not exist.`);
			continue;
		}
		const shared = read(git, ['merge-base', tip, head]);
		if (!shared) {
			notes.push(`${candidate} shares no fetched history with HEAD.`);
			continue;
		}
		if (shared !== head) {
			const message = `Ratchet base: merge-base of HEAD and ${candidate}.`;
			return { commit: shared, message: [...notes, message].join(' ') };
		}
		notes.push(`HEAD is already part of ${candidate}.`);
		break;
	}
	const parent = commitOf(git, 'HEAD^');
	const widen = `Set ${ratchetBaseVariable} to compare a wider range.`;
	if (parent) {
		const message = `Ratchet base: HEAD^, so only the last commit is compared. ${widen}`;
		return { commit: parent, message: [...notes, message].join(' ') };
	}
	return {
		commit: null,
		message: [...notes, `HEAD has no parent: debt ratchets have no base. ${widen}`].join(' ')
	};
}
