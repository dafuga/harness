import { randomUUID } from 'node:crypto';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { completionHooksConfig } from '../../../configs/agents-providers/completionHooksConfig';
import { recordTrackerNote } from '../../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { CompletionCheckError } from './CompletionCheckError';
import { loadCompletionConfig } from './completionConfig';
import { askCompletion, completionRecordPath, evaluateCompletion } from './completionRun';
import type { CompletionProvider, CompletionReceipt } from './completionRun.types';

export async function completeOrchestration(input: TaskRunInput, runProvider: CompletionProvider) {
	const { provider, model, intelligence, signal } = input;
	const tracker = input.supervision!.tracker;
	const git = new GitAdapter(input.cwd);
	const revision = await git.run(['rev-parse', 'HEAD']);
	const config = await loadCompletionConfig(git, revision);
	const result = await runProvider(
		{
			...input,
			prompt:
				input.prompt +
				'\n\nHarness runs the configured completion checks after this turn. Leave final handoff and landing pending until Harness reports completion.'
		},
		false
	);
	const id = tracker + '-' + randomUUID();
	const path = await completionRecordPath(git, id, 'orchestrator');
	const run = {
		id,
		path,
		revision,
		provider,
		model,
		intelligence,
		signal,
		scope: 'orchestrator' as const,
		checks: [] as CompletionReceipt[]
	};
	const passed = await evaluateCompletion(run, config.checks, async (check, receipt) => {
		const readOnly = check.name !== completionHooksConfig.simplify;
		receipt.summary = await askCompletion(runProvider, input, check, readOnly);
	});
	const results = run.checks.filter((check) => check.status !== 'disabled');
	if (results.length)
		await recordTrackerNote(
			input.cwd,
			tracker,
			'Harness completion: ' +
				results.map((check) => `${check.name} ${check.status}`).join(', ') +
				'. Run record: ' +
				path
		);
	if (!passed)
		throw new CompletionCheckError(
			'Required orchestration completion check failed. See the completion record.'
		);
	return result;
}
