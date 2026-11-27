// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../../src/core/errors';
import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ResourceQueueService } from '../../src/services/execution-runtimes/ResourceQueueService';
import { runIsolated } from '../../src/utils/reports-media/run-isolated/runIsolated';
import { checkKey, SharedCheckCache } from './checkCache';
import { checkGit, inCheckWorktree } from './checkGit';
import { withSharedCheckLease } from './checkLease';
import { checkPlan, installCheckDependencies } from './checkPlanning';
import type { CheckQueue } from './checkQueue';
import type { CheckOutcome, CheckSnapshot } from './checkExecution.types';
import { existingProof, refreshSharedProof } from './checkProof';
import {
	allowsE2e,
	backgroundArguments,
	checkEnvironment,
	checkTypeConfig,
	withLegacyCheckSlot
} from './checkScheduling';
import type {
	CandidateTree,
	CheckObservation,
	CheckPlan,
	CandidateRun,
	SharedCheck
} from './sharedCheck.types';

export async function executeCandidate(
	queue: CheckQueue,
	candidate: CandidateTree,
	release: boolean,
	signal: AbortSignal
): Promise<CheckOutcome> {
	const started = performance.now();
	const previous = release ? undefined : queue.plan(candidate);
	const plan = previous ?? (await checkPlan(candidate, release));
	if (!previous && plan.mode === 'focused') queue.storePlan(candidate, plan);
	const finish = candidateOutcome(candidate, plan, started);
	const cache = new SharedCheckCache(queue, candidate);
	const satisfied = existingProof(cache, candidate, plan);

	if (satisfied.size === plan.checks.length) return finish('passed', [...satisfied.values()]);
	if (plan.mode === 'unknown') {
		return finish(
			'blocked',
			[...satisfied.values()],
			`${plan.reason} Include this candidate in the combined release check.`
		);
	}
	if (
		!allowsE2e() &&
		(plan.checks.some((check) => check.browser && !satisfied.has(check.id)) ||
			plan.setup?.some((check) => check.browser))
	) {
		return finish(
			'blocked',
			[...satisfied.values()],
			'This batch needs automated E2E or a full check. Submit the exact candidates on harbor-mbp-2.'
		);
	}
	return await withSharedCheckLease(candidate, cache.remote, signal, async (leaseSignal) => {
		refreshSharedProof(cache, plan.checks, satisfied);
		if (satisfied.size === plan.checks.length) return finish('passed', [...satisfied.values()]);
		const { failed, observed } = await runCandidateChecks(
			{ queue, candidate, plan, cache },
			satisfied,
			leaseSignal
		);
		return finish(failed ? 'failed' : 'passed', observed, failed ?? plan.reason);
	});
}

async function runCandidateChecks(
	{ queue, candidate, plan, cache }: CandidateRun,
	satisfied: ReadonlyMap<string, CheckObservation>,
	signal: AbortSignal
) {
	const observed: CheckObservation[] = [];
	const resources = new ResourceQueueService();
	try {
		const failed = await withLegacyCheckSlot(plan.mode !== 'focused', signal, () =>
			resources.run(
				{
					label: 'Shared Harness checks',
					priority: 'agent-test',
					cpus: 1,
					memoryMiB: 2048
				},
				(context) =>
					inCheckWorktree(candidate, queue.home, (directory) =>
						runPlan(
							{ plan, satisfied },
							{ directory, queue, signal, env: context.env, track: context.track },
							cache,
							observed
						)
					),
				{ signal }
			)
		);
		return { failed, observed };
	} finally {
		resources.close();
	}
}

function candidateOutcome(candidate: CandidateTree, plan: CheckPlan, started: number) {
	return (
		status: CheckOutcome['status'],
		checks: CheckObservation[],
		detail = plan.reason
	): CheckOutcome => ({
		status,
		mode: plan.mode,
		base: candidate.base,
		testedCommit: candidate.commit,
		workerRssBytes: process.memoryUsage().rss,
		tree: candidate.tree,
		checks,
		detail,
		elapsedMs: Math.round(performance.now() - started)
	});
}

async function runPlan(
	{ plan, satisfied }: { plan: CheckPlan; satisfied: ReadonlyMap<string, CheckObservation> },
	snapshot: CheckSnapshot,
	cache: SharedCheckCache,
	observed: CheckObservation[]
): Promise<string | undefined> {
	const setup = [installCheckDependencies, ...(plan.setup ?? [])].filter(
		(check) =>
			check !== installCheckDependencies || existsSync(join(snapshot.directory, 'bun.lock'))
	);
	for (const check of setup) {
		const result = await runCheck(snapshot, check);
		if (result.status !== 'passed') return `${check.id} ${result.status}. Log: ${result.log.path}`;
		checkGit(snapshot.directory, ['diff', '--quiet', 'HEAD', '--']);
	}
	try {
		return await runChecks({ checks: plan.checks, satisfied }, snapshot, cache, observed);
	} finally {
		const executed = new Set(
			observed.filter(({ source }) => source === 'executed').map(({ id }) => id)
		);
		cache.publish(plan.checks.filter((check) => executed.has(check.id) && cache.source(check)));
	}
}

async function runChecks(
	{
		checks,
		satisfied
	}: { checks: SharedCheck[]; satisfied: ReadonlyMap<string, CheckObservation> },
	snapshot: CheckSnapshot,
	cache: SharedCheckCache,
	observed: CheckObservation[]
): Promise<string | undefined> {
	for (const [index, check] of checks.entries()) {
		const previous = satisfied.get(check.id);
		const prepare =
			['build', 'build:kernel'].includes(check.id) &&
			checks.slice(index + 1).some((next) => !satisfied.has(next.id));
		if (previous && !prepare) {
			observed.push(previous);
			continue;
		}
		const result = await runCheck(snapshot, check);
		observed.push({
			id: check.id,
			key: checkKey(check),
			source: 'executed',
			ms: result.durationMs,
			log: result.log.path
		});
		if (result.status !== 'passed') return `${check.id} ${result.status}. Log: ${result.log.path}`;
		checkGit(snapshot.directory, ['diff', '--quiet', 'HEAD', '--']);
		cache.save(check);
	}
}

async function runCheck(snapshot: CheckSnapshot, check: SharedCheck) {
	const cwd = resolve(snapshot.directory, check.cwd ?? '.');
	const rel = relative(snapshot.directory, cwd);
	if (rel === '..' || rel.startsWith('../'))
		throw new ExpectedCliError('Check working directory escapes its snapshot.');
	const config =
		check.command[0] === 'tsc-files'
			? checkTypeConfig(snapshot.directory, cwd, check.command.slice(1))
			: undefined;
	const args = config
		? ['bun', 'x', '--no-install', 'tsc', '--noEmit', '-p', config]
		: check.command;
	try {
		return await runIsolated({
			command: '/usr/bin/nice',
			args: backgroundArguments(args),
			cwd,
			env: checkEnvironment(snapshot.env),
			signal: snapshot.signal,
			onSpawn: snapshot.track,
			timeoutMs: check.timeoutMs ?? 600_000,
			log: join(snapshot.queue.home, 'logs', `${randomUUID()}.log`),
			maxLogBytes: 2 * 1024 * 1024
		});
	} finally {
		if (config) unlinkSync(config);
	}
}
