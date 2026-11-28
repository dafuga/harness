// @harness-uid u_sbz3zzk4fx
import { hostname } from 'node:os';
import {
	CandidateConflict,
	checkGit,
	checkMain,
	combineCandidates,
	unpinCandidate
} from './checkGit';
import type { CheckQueue } from './checkQueue';
import type { CheckRequest, CheckResult, CheckWorkerDependencies } from './sharedCheck.types';

/** Elect a worker, drain one compatible priority batch, and deliver durable results. */
export async function workCheckQueue(
	queue: CheckQueue,
	deps: CheckWorkerDependencies
): Promise<boolean> {
	return await queue.work(async () => {
		if (queue.pending().length) {
			await Bun.sleep(750);
			const waiting = queue.pending();
			const first = waiting[0];
			if (first) {
				const batch = waiting.filter((request) => batchCompatible(first, request)).slice(0, 24);
				const results = await runBatch(batch, deps);
				deps.signal.throwIfAborted();
				queue.finish(results);
				for (const request of batch) {
					try {
						unpinCandidate(request);
					} catch {
						// A retained ref does not make an otherwise durable result disappear.
					}
				}
			}
		}
		await reportCompleted(queue, deps);
	});
}

function batchCompatible(first: CheckRequest, request: CheckRequest): boolean {
	return (
		first.repo === request.repo &&
		first.release === request.release &&
		first.base === request.base &&
		first.exact === request.exact &&
		(!first.exact || first.commit === request.commit)
	);
}

async function runBatch(batch: CheckRequest[], deps: CheckWorkerDependencies) {
	const results = new Map<string, CheckResult>();
	try {
		const first = batch[0]!;
		const base = first.base ?? checkMain(first.repo);
		await bisectBatch(batch, base, deps, results);
	} catch (error) {
		deps.signal.throwIfAborted();
		remember(batch, results, {
			status: 'blocked',
			checks: [],
			elapsedMs: 0,
			detail:
				error instanceof Error ? error.message : 'The shared worker could not complete the batch.'
		});
	}
	return results;
}

async function bisectBatch(
	batch: CheckRequest[],
	base: string,
	deps: CheckWorkerDependencies,
	results: Map<string, CheckResult>
): Promise<void> {
	deps.signal.throwIfAborted();
	const verdict = await tryBatch(batch, base, deps);
	if (verdict.status !== 'failed' || batch.length < 2) {
		remember(batch, results, verdict);
		return;
	}
	const midpoint = Math.ceil(batch.length / 2);
	await bisectBatch(batch.slice(0, midpoint), base, deps, results);
	await bisectBatch(batch.slice(midpoint), base, deps, results);
	const allPassed = batch.every(({ id }) => results.get(id)?.status === 'passed');
	for (const request of batch) {
		const single = results.get(request.id)!;
		const detail =
			`Combined batch of ${batch.length} failed${verdict.tree ? ` at tree ${verdict.tree}` : ''}. ${verdict.detail ?? ''}`.trim();
		results.set(request.id, {
			...single,
			status: allPassed ? 'failed' : single.status,
			detail: [detail, single.detail].filter(Boolean).join(' '),
			elapsedMs: single.elapsedMs + verdict.elapsedMs
		});
	}
}

async function tryBatch(batch: CheckRequest[], base: string, deps: CheckWorkerDependencies) {
	try {
		const first = batch[0]!;
		if (first.exact && checkGit(first.repo, ['merge-base', base, first.commit]) !== base) {
			return {
				status: 'blocked' as const,
				base,
				checks: [],
				elapsedMs: 0,
				detail: 'The exact candidate is behind main. Rebase the candidate and resubmit.'
			};
		}
		return await deps.run(combineCandidates(base, batch), first.release);
	} catch (error) {
		if (!(error instanceof CandidateConflict)) throw error;
		return { status: 'failed' as const, checks: [], elapsedMs: 0, detail: error.message };
	}
}

function remember(
	batch: CheckRequest[],
	results: Map<string, CheckResult>,
	verdict: Omit<CheckResult, 'batch'>
): void {
	const commits = batch.map(({ commit }) => commit);
	for (const request of batch) results.set(request.id, { ...verdict, batch: commits });
}

async function reportCompleted(queue: CheckQueue, deps: CheckWorkerDependencies): Promise<void> {
	for (const { request, result } of queue.unreported()) {
		try {
			if (request.item) await deps.note(request.item, trackerResult(request, result));
			queue.reported(request.id);
		} catch {
			console.error(`Tracker delivery pending for check request ${request.id}.`);
		}
	}
}

function trackerResult(request: CheckRequest, result: CheckResult): string {
	const { status, mode, base, tree, batch, elapsedMs, checks, detail } = result;
	const executed = checks.filter(({ source }) => source === 'executed').length;
	const reused = checks.length - executed;
	const selection = checks.map(({ id }) => id).join(', ');
	const ci = checks.find(({ source }) => source === 'github-ci')?.log;
	return [
		`Shared check ${status} on ${hostname()} for ${request.commit} (request ${request.id}).`,
		mode ? `Mode ${mode}.` : '',
		tree ? `Tree ${tree} against main ${base}.` : '',
		`Batch ${batch.map((commit) => commit.slice(0, 12)).join(', ')}. Elapsed ${elapsedMs} ms. ${executed} executed, ${reused} reused.`,
		selection ? `Checks: ${selection.slice(0, 700)}.` : '',
		ci ? `GitHub CI: ${ci}.` : '',
		detail ?? ''
	]
		.filter(Boolean)
		.join(' ');
}
