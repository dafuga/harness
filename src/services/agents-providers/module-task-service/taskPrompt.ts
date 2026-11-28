// @harness-uid u_rmurdehorf
import { createHash } from 'node:crypto';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { mockModePlanningRule } from '../../../utils/agents-providers/mockModePlanningRule';
export function moduleTaskPrompt(task: ModuleTask, commit: string): string {
	if (
		createHash('sha256').update(stableJson(task.wantedContract)).digest('hex') !== task.contractHash
	)
		throw new ExpectedCliError('Wanted contract hash does not match the committed task.');
	const workerBrief = [
		'Work on this feature through its module contracts. Follow the Harness workflow.',
		'Edit only the allowed task files in this prompt; never edit specification/units/; contracts are read-only.',
		'Do not delegate, commit, push, deploy or access credentials.',
		"Keep files within the repository's line and naming limits.",
		"Use the repository's test and lint commands. Report verification performed and remaining gaps.",
		'Preserve unrelated work. CLI completion is not verification.',
		'Open relevant sections of root AGENTS.md when the task needs them.',
		'Your only channel is Harness: put questions, blockers and contract doubts in your final message; do not contact anyone or any other service.'
	].join(' ');
	return [
		`Overall goal: ${task.feature.goal}`,
		`Feature TLDR: ${task.feature.tldr}`,
		workerBrief,
		mockModePlanningRule,
		`Module: ${task.module.id}`,
		`Overall module goal: ${task.module.goal}`,
		`Allowed task files: ${task.module.files.join(', ')}`,
		`Task: ${task.title} (${task.id})`,
		task.instructions,
		'Implement only the wanted contract below. A previous attempt may have left edits; inspect current files before changing them. Report verification performed and remaining gaps.',
		`Original source revision: ${task.sourceCommit}`,
		`Current repair source revision: ${task.repairCommit ?? task.sourceCommit}`,
		...(task.reviews.length ? [`Latest review feedback: ${task.reviews.at(-1)!.feedback}`] : []),
		`Committed task: ${commit} on refs/harness/tasks; contract SHA256: ${task.contractHash}`,
		'Wanted contract:',
		stableJson(task.wantedContract)
	].join('\n');
}
export function taskSelection(
	task: Pick<ModuleTaskInput, 'model' | 'provider' | 'intelligence'>
): TaskSelection {
	if (task.model === 'auto') {
		if (task.provider || task.intelligence)
			throw new ExpectedCliError(
				'Set an explicit model before provider or intelligence; auto owns both choices.'
			);
		return { provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'medium' };
	}
	const provider = task.provider ?? modelProvider(task.model);
	if (!provider) throw new ExpectedCliError('Set provider for this exact model id.');
	if (provider === 'claude' && task.intelligence === 'ultra')
		throw new ExpectedCliError('Claude does not support ultra intelligence.');
	return { provider, model: task.model, intelligence: task.intelligence ?? 'medium' };
}
function modelProvider(model: string): TaskSelection['provider'] | undefined {
	if (model.startsWith('claude-')) return 'claude';
	if (model.startsWith('gpt-')) return 'codex';
	return undefined;
}
