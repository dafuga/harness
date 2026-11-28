// @harness-uid u_xghv2ih7cg
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { completionHooksConfig } from '../../../configs/agents-providers/completionHooksConfig';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { taskWrites } from '../module-task-worker-service/taskClaim';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { assessReduction, measureBaseline } from './assessReduction';
import { CompletionCheckError } from './CompletionCheckError';
import { loadCompletionConfig } from './completionConfig';
import {
	askCompletion,
	completionRecordPath,
	completionSummary,
	evaluateCompletion
} from './completionRun';
import type { CompletionCheck, CompletionReceipt } from './completionRun.types';
import type {
	ModuleCandidate,
	ModuleCompletionContext,
	ModuleCompletionInput
} from './moduleCompletion.types';

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
		result.text += '\nCompletion record: ' + path + '\n' + completionSummary(run.checks);
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
		const readable = await measureBaseline(candidate, receipt, measure);
		await requireSameTree(base, await candidateCheckpoint(input, scratch, base), scratch);
		if (!readable) return;
	}
	const proposedReduction = await moduleReviewVerdict(
		context,
		{
			...result,
			cwd: scratch.root,
			signal: context.signal,
			prompt: moduleCheckPrompt(task.module.id, source, tests)
		},
		check,
		receipt
	);
	const paths = await taskWrites(scratch, { ...task, sourceCommit: base });
	if (!proposedReduction) return;
	if (!measured) {
		if (paths.length)
			throw new CompletionCheckError('A read-only completion check changed the worktree.');
		return;
	}
	const proposed = await candidateCheckpoint(input, scratch, base);
	const accepted = await assessReduction(candidate, { proposed, paths, receipt, measure });
	if (!accepted || !paths.length) return;
	await requireSameTree(proposed, await candidateCheckpoint(input, scratch, base), scratch);
	await promoteModule(candidate, proposed, receipt);
}

async function moduleReviewVerdict(
	context: ModuleCompletionContext,
	input: TaskRunInput,
	check: CompletionCheck,
	receipt: CompletionReceipt
): Promise<boolean> {
	const measured = check.name === completionHooksConfig.reduce;
	try {
		receipt.summary = await askCompletion(
			context.runner.run.bind(context.runner),
			input,
			check,
			!measured
		);
		return true;
	} catch (error) {
		if (!measured || !(error instanceof CompletionCheckError) || !error.summary) throw error;
		receipt.summary = error.summary;
		receipt.reason = error.message;
		return false;
	}
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
	receipt: CompletionReceipt
) {
	const { input, scratch, base } = candidate;
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
