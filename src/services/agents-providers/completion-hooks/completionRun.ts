// @harness-uid u_xghv2ih7cg
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	CompletionCheck,
	CompletionProvider,
	CompletionReceipt,
	CompletionRun
} from './completionRun.types';
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';
import { CompletionCheckError } from './CompletionCheckError';

export const completionTurn = Symbol('completion turn read-only');

export async function completionRecordPath(
	git: GitAdapter,
	id: string,
	scope: CompletionRun['scope']
) {
	const base = await git.run(['rev-parse', '--path-format=absolute', '--git-common-dir']);
	return join(base, 'harness-completion', scope, `${id}.json`);
}

export async function evaluateCompletion(
	run: CompletionRun,
	checks: CompletionCheck[],
	evaluate: (check: CompletionCheck, receipt: CompletionReceipt) => Promise<void>
): Promise<boolean> {
	for (const check of checks.filter(({ scope }) => scope === run.scope)) {
		const receipt: CompletionReceipt = {
			name: check.name,
			required: check.required,
			status: check.enabled ? 'passed' : 'disabled'
		};
		if (check.enabled) await runCheck(run.signal, receipt, () => evaluate(check, receipt));
		run.checks.push(receipt);
		await saveCompletion(run);
	}
	if (!run.checks.length) await saveCompletion(run);
	return (
		!run.signal.aborted &&
		run.checks.every(
			({ required, status }) => !required || status === 'passed' || status === 'disabled'
		)
	);
}

async function runCheck(
	signal: AbortSignal,
	receipt: CompletionReceipt,
	evaluate: () => Promise<void>
) {
	if (signal.aborted) {
		receipt.status = 'blocked';
		receipt.reason = 'The task was interrupted.';
		return;
	}
	try {
		await evaluate();
	} catch (error) {
		receipt.status = 'failed';
		if (error instanceof CompletionCheckError && error.summary) receipt.summary = error.summary;
		receipt.reason =
			error instanceof CompletionCheckError ? error.message : 'Completion check could not finish.';
	}
}

export function completionSummary(receipts: CompletionReceipt[]): string {
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

export async function saveCompletion(run: CompletionRun): Promise<void> {
	const { path, id, scope, revision, provider, model, intelligence, checks, tracking } = run;
	const data = { id, scope, revision, provider, model, intelligence, checks, tracking };
	const temporary = `${path}.${randomUUID()}.tmp`;
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	try {
		await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}

export async function askCompletion(
	run: CompletionProvider,
	input: TaskRunInput,
	check: CompletionCheck,
	readOnly: boolean
): Promise<string> {
	const checkPrompt = [
		`Harness completion check: ${check.name}`,
		check.prompt,
		input.prompt,
		readOnly
			? 'Read files only. Keep the workspace unchanged.'
			: 'Edit only the files allowed by this check.',
		'Do not commit, push, land, contact Tracker, change configuration, start workers, or access credentials.',
		'Return only JSON with status ("passed" or "failed") and summary. Give a short, concrete summary of what you simplified or found. Exclude secrets and raw logs.'
	].join('\n\n');
	const reply = await run({
		...input,
		prompt: checkPrompt,
		supervision: undefined,
		onRotation: undefined,
		[completionTurn]: readOnly
	});
	input.signal.throwIfAborted();
	const result = completionReply(reply.text);
	if (result.status === 'failed')
		throw new CompletionCheckError('Provider reported a failed check.', result.summary);
	return result.summary;
}

function completionReply(text: string): { status: string; summary: string } {
	try {
		const { status, summary } = JSON.parse(
			text.trim().replace(/^```(?:json)?\s*([\s\S]+)\s*```$/, '$1')
		);
		if (['passed', 'failed'].includes(status) && typeof summary === 'string' && summary.trim()) {
			return { status, summary: redactSecrets(summary).trim().replace(/\s+/g, ' ').slice(0, 500) };
		}
	} catch {
		// Provider output is untrusted and stays out of failure messages.
	}
	throw new CompletionCheckError('Provider did not return a completion verdict.');
}
