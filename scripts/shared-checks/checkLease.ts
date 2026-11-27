// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../../src/core/errors';
import { randomUUID } from 'node:crypto';
import { checkGit, emptyCheckCommit } from './checkGit';
import type { CandidateTree, CheckLeaseTarget } from './sharedCheck.types';

const leaseMs = 180_000;
const renewalMs = 45_000;

export async function withSharedCheckLease<T>(
	candidate: CandidateTree,
	remote: string | undefined,
	signal: AbortSignal,
	check: (signal: AbortSignal) => Promise<T>
): Promise<T> {
	if (!remote) return await check(signal);
	const { repo, tree } = candidate;
	const ref = `refs/harness/check-inflight/v1/${tree}`;
	const lost = new AbortController();
	const target = { repo, remote, ref, owner: randomUUID() };
	let held = await claimCheckLease(target, signal);
	const timer = setInterval(() => {
		try {
			held = writeLease(target, held);
		} catch {
			lost.abort(new ExpectedCliError('The shared check lease could not be renewed.'));
		}
	}, renewalMs);
	try {
		const result = await check(AbortSignal.any([signal, lost.signal]));
		lost.signal.throwIfAborted();
		return result;
	} finally {
		clearInterval(timer);
		try {
			pushLease(target, held);
		} catch {
			// The exact ownership check prevents deleting another worker's lease.
		}
	}
}

async function claimCheckLease(target: CheckLeaseTarget, signal: AbortSignal): Promise<string> {
	while (true) {
		signal.throwIfAborted();
		const prior = readLease(target);
		if (!prior || expiry(target, prior) < Date.now()) {
			try {
				return writeLease(target, prior);
			} catch {
				if (readLease(target) === prior)
					throw new ExpectedCliError('The shared Git remote did not accept the check lease.');
			}
		}
		await Bun.sleep(2_000);
	}
}

function readLease({ repo, remote, ref }: CheckLeaseTarget): string | undefined {
	const listed = checkGit(repo, ['ls-remote', '--refs', remote, ref]);
	return listed ? listed.split('\t')[0] : undefined;
}

function expiry({ repo, remote, ref }: CheckLeaseTarget, oid: string): number {
	try {
		return leaseExpiry(repo, oid);
	} catch {
		checkGit(repo, ['fetch', '--no-tags', '--no-auto-gc', '--no-write-fetch-head', remote, ref]);
		return leaseExpiry(repo, oid);
	}
}

function leaseExpiry(repo: string, oid: string): number {
	const message = checkGit(repo, ['show', '-s', '--format=%B', oid]);
	const match = /^Harness check lease v1\n(\d+)\n[0-9a-f-]+$/.exec(message);
	const expires = Number(match?.[1]);
	if (!Number.isSafeInteger(expires))
		throw new ExpectedCliError('The shared check lease is invalid.');
	return expires;
}

function writeLease(target: CheckLeaseTarget, prior: string | undefined): string {
	const expires = Date.now() + leaseMs;
	const oid = emptyCheckCommit(
		target.repo,
		`Harness check lease v1\n${expires}\n${target.owner}\n`,
		true
	);
	pushLease(target, prior, oid);
	return oid;
}

function pushLease({ repo, remote, ref }: CheckLeaseTarget, prior: string | undefined, oid = '') {
	checkGit(repo, [
		'push',
		'--quiet',
		'--no-verify',
		`--force-with-lease=${ref}:${prior ?? ''}`,
		remote,
		`${oid}:${ref}`
	]);
}
