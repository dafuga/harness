// @harness-uid u_r7qgepnoax
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { setInterval, clearInterval } from 'node:timers';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type {
	LandingRequest,
	LandingDecision
} from '../../../services/projects-sessions/tracker-hub-sync/trackerLandingQueue';
import type { trackerLandingGit } from './trackerLandingGit';

export type LandingPort = (request: LandingRequest) => Promise<LandingDecision>;

/** The caller owns its checkout. Only the hub authorizes the final, non-expiring merge slot. */
export async function trackerLandPull(
	target: { id: string; pr: number },
	queue: LandingPort,
	git: ReturnType<typeof trackerLandingGit>,
	signal: AbortSignal
) {
	const { id, pr } = target;
	const original = await git.checkout();
	const common = { repo: original.repo, id, pr, ticket: randomUUID() };
	let release = true;
	await waitForTurn(() => queue({ ...common, action: 'wait' }), signal);
	const heartbeat = renewSlot(() => queue({ ...common, action: 'renew' }));
	try {
		const candidate = await prepareLanding(original, target, git);
		await heartbeat.stop();
		signal.throwIfAborted();
		if (heartbeat.lost()) throw new ExpectedCliError('Repository landing lease was interrupted');
		const approved = await queue({ ...common, ...candidate, action: 'authorize' });
		if (!approved.allowed) throw new ExpectedCliError(approved.reason);
		if ((await git.base()) !== candidate.base)
			throw new ExpectedCliError('main moved after the focused check');
		// A lost GitHub reply leaves the slot held until the merged state can be reconciled.
		release = false;
		try {
			await git.merge(original.repo, pr, candidate.head);
		} catch {
			/* Read back the actual GitHub result before releasing the slot. */
		}
		const result = await git.pull(original.repo, pr);
		if (result.state !== 'MERGED' || !result.mergeCommit || result.headRefOid !== candidate.head)
			throw new ExpectedCliError(
				`Merge unconfirmed. Run tracker land ${id} ${pr} --reconcile on this computer`
			);
		await git.verifyMerged(result.mergeCommit.oid, candidate.base, candidate.head);
		release = true;
		return `Merged ${original.repo}#${pr} at ${result.mergeCommit.oid} from checked head ${candidate.head}`;
	} finally {
		await heartbeat.stop();
		if (release) await queue({ ...common, action: 'release' });
	}
}

async function prepareLanding(
	original: Awaited<ReturnType<ReturnType<typeof trackerLandingGit>['checkout']>>,
	{ id, pr }: { id: string; pr: number },
	git: ReturnType<typeof trackerLandingGit>
) {
	const info = await git.pull(original.repo, pr);
	assertPull(info, original);
	const checkout = await git.checkout();
	if (!sameCheckout(checkout, original))
		throw new ExpectedCliError('Checkout changed while waiting');
	const base = await git.base();
	const head = await git.rebase(base, original.sha);
	await git.publish(original.branch, original.sha, head);
	await git.check(id, head, base);
	const checked = await git.checkout();
	if (!sameCheckout(checked, { ...original, sha: head }) || (await git.base()) !== base)
		throw new ExpectedCliError('Checked candidate or main moved during focused checks');
	assertPull(await git.pull(original.repo, pr), { ...original, sha: head });
	return { base, head };
}

async function waitForTurn(poll: () => Promise<LandingDecision>, signal: AbortSignal) {
	for (;;) {
		signal.throwIfAborted();
		const decision = await poll();
		if (decision.allowed) return;
		if (!decision.reason.startsWith('queued behind ')) throw new ExpectedCliError(decision.reason);
		await delay(5000, undefined, { signal });
	}
}
function renewSlot(renew: () => Promise<LandingDecision>) {
	let lost = false;
	let pending: Promise<void> | undefined;
	const timer = setInterval(() => {
		pending ??= renew()
			.then(
				(reply) => {
					if (!reply.allowed) lost = true;
				},
				() => {
					lost = true;
				}
			)
			.finally(() => {
				pending = undefined;
			});
	}, 15000);
	return {
		lost: () => lost,
		async stop() {
			clearInterval(timer);
			await pending;
		}
	};
}

type Checkout = { sha: string; branch: string; repo: string };
function sameCheckout(a: Checkout, b: Checkout) {
	return a.sha === b.sha && a.branch === b.branch && a.repo === b.repo;
}
function assertPull(
	pr: {
		state: string;
		headRefOid: string;
		headRefName: string;
		isDraft: boolean;
		closingIssuesReferences: unknown[];
	},
	checkout: Checkout
) {
	if (
		pr.isDraft ||
		pr.closingIssuesReferences.length ||
		pr.state !== 'OPEN' ||
		pr.headRefOid !== checkout.sha ||
		pr.headRefName !== checkout.branch
	)
		throw new ExpectedCliError('PR head must match the checked-out feature branch');
}

export async function reconcileLanding(
	target: { id: string; pr: number },
	queue: LandingPort,
	git: ReturnType<typeof trackerLandingGit>
) {
	const { repo } = await git.checkout();
	const common = { ...target, repo, ticket: randomUUID() };
	const { pinned, reason } = await queue({ ...common, action: 'inspect' });
	if (!pinned) throw new ExpectedCliError(reason);
	const result = await git.pull(repo, target.pr);
	if (result.state === 'MERGED') {
		if (!result.mergeCommit || result.headRefOid !== pinned.head)
			throw new ExpectedCliError(
				'Merged head differs from the checked candidate. Chief of Staff must reconcile the repository.'
			);
		await git.verifyMerged(result.mergeCommit.oid, pinned.base, pinned.head);
	} else if (result.state === 'OPEN' && result.headRefOid === pinned.head) {
		throw new ExpectedCliError(
			'Merge outcome is unresolved. Wait for GitHub or close this PR to fence the old merge request.'
		);
	}
	const released = await queue({ ...common, ticket: pinned.ticket, action: 'release' });
	if (!released.allowed) throw new ExpectedCliError(released.reason);
	return 'Reconciled ' + repo + '#' + target.pr + ' and released the landing slot';
}
