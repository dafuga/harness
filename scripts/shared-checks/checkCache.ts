// @harness-uid u_sbz3zzk4fx
import { createHash } from 'node:crypto';
import { checkGit, emptyCheckCommit } from './checkGit';
import type { CheckQueue } from './checkQueue';
import type { CandidateTree, SharedCheck } from './sharedCheck.types';

const canonicalOrigin =
	/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)dafuga\/harness(?:\.git)?$/i;

export function trustedCheckRemote(repo: string): boolean {
	try {
		return canonicalOrigin.test(checkGit(repo, ['remote', 'get-url', 'origin']));
	} catch {
		return false;
	}
}

/** Equal trees reuse the same check when the runner, command and host capabilities match. */
export function checkKey(check: SharedCheck): string {
	return createHash('sha256')
		.update(JSON.stringify(['1', process.platform, process.arch, Bun.version, check]))
		.digest('hex');
}

/** The published object carries a receipt only. It cannot publish candidate source or history. */
export class SharedCheckCache {
	readonly remote: string | undefined;
	private readonly shared = new Set<string>();

	constructor(
		private readonly queue: CheckQueue,
		private readonly candidate: CandidateTree,
		remote: string | undefined = defaultCacheRemote(candidate.repo)
	) {
		this.remote = remote;
	}

	readShared(checks: readonly SharedCheck[]): void {
		if (
			!this.remote ||
			checks.every((check) => this.queue.cached(this.candidate.tree, checkKey(check)))
		)
			return;
		try {
			const { repo, tree } = this.candidate;
			const receipts = checkGit(repo, [
				'ls-remote',
				'--refs',
				this.remote,
				`refs/harness/check-cache/v1/${tree}/*`
			]);
			const expected = new Map(checks.map((check) => [this.ref(check), check]));
			for (const line of receipts.split('\n')) {
				const [oid, ref] = line.split('\t');
				const check = expected.get(ref!);
				if (check && oid === this.receipt(check)) this.shared.add(checkKey(check));
			}
		} catch {
			// GitHub may be offline. A remote read failure is a cache miss.
		}
	}

	source(check: SharedCheck): 'local-cache' | 'shared-cache' | undefined {
		const key = checkKey(check);
		if (this.queue.cached(this.candidate.tree, key)) return 'local-cache';
		if (this.shared.has(key)) return 'shared-cache';
		return undefined;
	}

	save(check: SharedCheck): void {
		this.queue.cache(this.candidate.tree, checkKey(check));
	}

	publish(checks: readonly SharedCheck[]): void {
		if (!this.remote || !checks.length) return;
		try {
			const specs = checks.map((check) => `${this.receipt(check, true)}:${this.ref(check)}`);
			checkGit(this.candidate.repo, ['push', '--quiet', '--no-verify', this.remote, ...specs]);
		} catch {
			// Local proof remains available when the shared Git remote cannot accept writes.
		}
	}

	private ref(check: SharedCheck): string {
		return `refs/harness/check-cache/v1/${this.candidate.tree}/${checkKey(check)}`;
	}

	private receipt(check: SharedCheck, write = false): string {
		return emptyCheckCommit(
			this.candidate.repo,
			`Harness successful check\n${this.ref(check)}\n`,
			write
		);
	}
}

function defaultCacheRemote(repo: string): string | undefined {
	return process.env.GITHUB_ACTIONS !== 'true' && trustedCheckRemote(repo) ? 'origin' : undefined;
}
