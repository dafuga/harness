// @harness-uid u_xghv2ih7cg
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { completionHooksConfig } from '../../../configs/agents-providers/completionHooksConfig';
import { taskWrites } from '../module-task-worker-service/taskClaim';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { CompletionCheckError } from './CompletionCheckError';
import { loadCompletionConfig } from './completionConfig';
import { askCompletion, completionRecordPath, evaluateCompletion } from './completionRun';
import type { CompletionCheck, CompletionReceipt } from './completionRun.types';
import { moduleCompletionMeasurement } from './moduleCompletionMeasurement';
import { requireNondecreasingCoverage } from './lcovCoverage';
import type { ModuleCandidate, ModuleCompletionInput } from './moduleCompletion.types';

export const moduleCompletionContext = Symbol('module completion context');

export async function completeModule(input: ModuleCompletionInput): Promise<void> {
	const { owner, task, result, context } = input;
	const revision = result.sourceCommit ?? task.sourceCommit;
	const config = await loadCompletionConfig(owner, revision);
	const id = task.claim!.token;
	const path = await completionRecordPath(owner, id, 'module');
	const run = {
		id,
		path,
		revision,
		scope: 'module' as const,
		checks: [] as CompletionReceipt[],
		signal: context.signal,
		provider: result.provider,
		model: result.model,
		intelligence: result.intelligence
	};
	try {
		const passed = await evaluateCompletion(run, config.checks, (check, receipt) =>
			withModuleCandidate(input, config.moduleVerification, (candidate) =>
				reviewModule(candidate, check, receipt)
			)
		);
		if (!passed)
			throw new CompletionCheckError(
				'Required module completion check failed. See the completion record.'
			);
	} finally {
		result.text += '\nCompletion record: ' + path + '\n' + moduleCheckSummary(run.checks);
	}
}

async function withModuleCandidate(
	input: ModuleCompletionInput,
	verification: ModuleCandidate['verification'],
	review: (candidate: ModuleCandidate) => Promise<void>
): Promise<void> {
	const { owner, result } = input;
	const base = await candidateCheckpoint(
		input,
		new GitAdapter(result.worktree),
		result.sourceCommit ?? input.task.sourceCommit
	);
	const directory = await mkdtemp(join(tmpdir(), 'harness-module-completion-'));
	const scratch = new GitAdapter(join(await realpath(directory), 'worktree'));
	let added = false;
	try {
		await owner.run([
			'-c',
			'core.hooksPath=/dev/null',
			'worktree',
			'add',
			'--detach',
			scratch.root,
			base
		]);
		added = true;
		await input.prepare?.(scratch.root);
		await review({ scratch, input, base, verification, reportDirectory: directory });
	} finally {
		if (added) await owner.run(['worktree', 'remove', '--force', scratch.root]);
		await rm(directory, { recursive: true, force: true });
	}
}

async function reviewModule(
	candidate: ModuleCandidate,
	check: CompletionCheck,
	receipt: CompletionReceipt
) {
	const { input, scratch, base } = candidate;
	const measured = check.name === completionHooksConfig.reduce;
	if (measured) receipt.disposition = 'discarded';
	const { task, result, context } = input;
	const tests = task.verificationFiles ?? [];
	const source = task.module.files.filter((path) => !tests.includes(path));
	const measure = {
		git: scratch,
		source,
		tests,
		command: candidate.verification,
		signal: context.signal
	};
	if (measured) {
		await moduleCompletionMeasurement(
			measure,
			base,
			join(candidate.reportDirectory, 'before'),
			(reading) => (receipt.before = reading)
		);
		await requireSameTree(base, await candidateCheckpoint(input, scratch, base), scratch);
	}
	receipt.summary = await askCompletion(
		context.runner.run.bind(context.runner),
		{
			...result,
			cwd: scratch.root,
			signal: context.signal,
			prompt: moduleCheckPrompt(task.module.id, source, tests)
		},
		check,
		!measured
	);
	const paths = await taskWrites(scratch, { ...task, sourceCommit: base });
	if (!measured) {
		if (paths.length)
			throw new CompletionCheckError('A read-only completion check changed the worktree.');
		return;
	}
	const proposed = await candidateCheckpoint(input, scratch, base);
	await moduleCompletionMeasurement(
		measure,
		proposed,
		join(candidate.reportDirectory, 'after'),
		(reading) => (receipt.after = reading)
	);
	await requireSameTree(proposed, await candidateCheckpoint(input, scratch, base), scratch);
	await promoteModule(candidate, proposed, paths, receipt);
}

function moduleCheckPrompt(module: string, source: string[], tests: string[]): string {
	return [
		`Module: ${module}`,
		`Allowed source files: ${source.join(', ')}`,
		`Allowed test files: ${tests.join(', ')}`,
		'Leave test selection, runner configuration, and coverage instrumentation unchanged.'
	].join('\n');
}

async function promoteModule(
	candidate: ModuleCandidate,
	proposed: string,
	paths: string[],
	receipt: CompletionReceipt
) {
	const { input, scratch, base } = candidate;
	const { before, after } = receipt;
	const tests = input.task.verificationFiles ?? [];
	requireNondecreasingCoverage(
		before!.coverage!,
		after!.coverage!,
		paths.filter((path) => !tests.includes(path))
	);
	if (!paths.length) {
		receipt.disposition = 'unchanged';
		return;
	}
	if (after!.bytes.source >= before!.bytes.source || after!.bytes.tests >= before!.bytes.tests)
		throw new CompletionCheckError('The candidate did not reduce both source and test bytes.');
	const working = new GitAdapter(input.result.worktree);
	const current = await candidateCheckpoint(
		input,
		working,
		input.result.sourceCommit ?? input.task.sourceCommit
	);
	await requireSameTree(base, current, working);
	const patch = await scratch.bytes([
		'diff',
		'--binary',
		'--no-renames',
		'--no-ext-diff',
		'--no-textconv',
		base,
		proposed
	]);
	input.context.signal.throwIfAborted();
	await working.run(['apply', '--whitespace=nowarn', '-'], { input: patch });
	receipt.disposition = 'applied';
}

async function candidateCheckpoint(input: ModuleCompletionInput, git: GitAdapter, source: string) {
	const paths = await taskWrites(git, { ...input.task, sourceCommit: source });
	return new ModuleTaskWorktreeAdapter(input.owner.root).checkpoint({
		cwd: git.root,
		source,
		paths
	});
}

async function requireSameTree(before: string, after: string, git: GitAdapter) {
	if (before === after) return;
	const [first, last] = (await git.run(['rev-parse', `${before}^{tree}`, `${after}^{tree}`])).split(
		'\n'
	);
	if (first !== last)
		throw new CompletionCheckError('The measured worktree changed during verification.');
}

function moduleCheckSummary(receipts: CompletionReceipt[]): string {
	return receipts
		.map((receipt) => {
			const line = `Completion check ${receipt.name}: ${receipt.status}`;
			const evidence =
				receipt.before || receipt.after
					? ` ${JSON.stringify({ before: receipt.before, after: receipt.after, disposition: receipt.disposition })}`
					: '';
			return line + evidence;
		})
		.join('\n');
}
