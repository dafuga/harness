import { randomUUID } from 'node:crypto';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { completionHooksConfig } from '../../../configs/agents-providers/completionHooksConfig';
import { recordTrackerNote } from '../../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';
import type { TaskRunInput } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { CompletionCheckError } from './CompletionCheckError';
import { loadCompletionConfig } from './completionConfig';
import {
	askCompletion,
	completionRecordPath,
	evaluateCompletion,
	saveCompletion
} from './completionRun';
import type { CompletionProvider, CompletionRun } from './completionRun.types';

export async function completeOrchestration(input: TaskRunInput, runProvider: CompletionProvider) {
	const { provider, model, intelligence, signal } = input;
	const tracker = input.supervision!.tracker;
	const git = new GitAdapter(input.cwd);
	const revision = await git.run(['rev-parse', 'HEAD']);
	const config = await loadCompletionConfig(git, revision);
	const result = await runProvider({
		...input,
		prompt:
			input.prompt +
			'\n\nHarness runs the configured completion checks after this turn. Leave final handoff and landing pending until Harness reports completion.'
	});
	const id = tracker + '-' + randomUUID();
	const path = await completionRecordPath(git, id, 'orchestrator');
	const run: CompletionRun = {
		id,
		path,
		revision,
		provider,
		model,
		intelligence,
		signal,
		scope: 'orchestrator',
		checks: []
	};
	const passed = await evaluateCompletion(run, config.checks, async (check, receipt) => {
		const readOnly = check.name !== completionHooksConfig.simplify;
		receipt.summary = await askCompletion(runProvider, input, check, readOnly);
	});
	await noteOrchestrationCompletion(input.cwd, tracker, run);
	if (!passed)
		throw new CompletionCheckError(
			'Required orchestration completion check failed. Run record: ' + path
		);
	return result;
}

async function noteOrchestrationCompletion(root: string, tracker: string, run: CompletionRun) {
	const results = run.checks.filter((check) => check.status !== 'disabled');
	if (!results.length) return;
	try {
		await recordTrackerNote(
			root,
			tracker,
			'Harness completion: ' +
				results.map((check) => `${check.name} ${check.status}`).join(', ') +
				'. Run record: ' +
				run.path
		);
		run.tracking = { item: tracker, status: 'recorded' };
	} catch {
		run.tracking = { item: tracker, status: 'unavailable' };
		console.warn('Could not send the completion result to Tracker. Run record: ' + run.path);
	}
	await saveCompletion(run);
}
