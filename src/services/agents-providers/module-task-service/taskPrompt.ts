import { createHash } from 'node:crypto';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
export function moduleTaskPrompt(task: ModuleTask, commit: string): string {
	if (
		createHash('sha256').update(stableJson(task.wantedContract)).digest('hex') !== task.contractHash
	)
		throw new Error('Wanted contract hash does not match the committed task.');
	return [
		`Overall goal: ${task.feature.goal}`,
		`Feature TLDR: ${task.feature.tldr}`,
		'Work on this feature through its module contracts. Follow AGENTS.md and the Harness workflow. Do not delegate, commit, push, deploy or access credentials. Preserve unrelated work. CLI completion is not verification.',
		`Module: ${task.module.id}`,
		`Overall module goal: ${task.module.goal}`,
		`Allowed task files: ${task.module.files.join(', ')}`,
		`Task: ${task.title} (${task.id})`,
		task.instructions,
		'Implement only the wanted contract below. A previous attempt may have left edits; inspect current files before changing them. Report verification performed and remaining gaps.',
		`Source revision: ${task.sourceCommit}`,
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
			throw new Error(
				'Set an explicit model before provider or intelligence; auto owns both choices.'
			);
		return { provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'medium' };
	}
	const provider =
		task.provider ??
		(task.model.startsWith('claude-')
			? 'claude'
			: task.model.startsWith('gpt-')
				? 'codex'
				: undefined);
	if (!provider) throw new Error('Set provider for this exact model id.');
	if (provider === 'claude' && task.intelligence === 'ultra')
		throw new Error('Claude does not support ultra intelligence.');
	return { provider, model: task.model, intelligence: task.intelligence ?? 'medium' };
}
