import { createHash } from 'node:crypto';
import type {
	ModuleTask,
	ModuleTaskInput,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { bugRepairPolicy } from '../../../utils/development-tooling/bugRepairPolicy';
const testFile = /(^|\/)(test|tests)\/|\.(test|spec)\.[jt]sx?$/;
export function preparedTaskFiles(task: ModuleTask): string[] {
	const role = task.role ?? 'implementation';
	const verification = new Set(task.verificationFiles ?? []);
	const assigned = task.assignedFiles ?? task.module.files;
	return assigned.filter(
		(file) =>
			task.module.files.includes(file) &&
			(role === 'verification'
				? verification.has(file) && testFile.test(file)
				: !verification.has(file) && !testFile.test(file))
	);
}
export function moduleTaskPrompt(
	task: ModuleTask,
	commit: string,
	files = preparedTaskFiles(task),
	role = task.role ?? 'implementation'
): string {
	if (
		createHash('sha256').update(stableJson(task.wantedContract)).digest('hex') !== task.contractHash
	)
		throw new Error('Wanted contract hash does not match the committed task.');
	return [
		`Overall goal: ${task.feature.goal}`,
		`Feature TLDR: ${task.feature.tldr}`,
		'Work on this feature through its module contracts. Follow AGENTS.md and the Harness workflow. Do not commit, push, deploy or access credentials. Do not delegate, self-escalate or widen your file grant. Do not accept or approve your own work. Preserve unrelated work. CLI completion is not verification.',
		'You may read committed app-wide unit contracts for discovery; source access is limited to the exact assigned files.',
		`Module: ${task.module.id}`,
		`Overall module goal: ${task.module.goal}`,
		`Task role: ${role}`,
		`Allowed task files: ${files.join(', ')}`,
		role === 'verification'
			? 'Verification capability: edit only explicitly assigned test or verification files; do not edit implementation source.'
			: 'Implementation capability: edit only assigned module-owned source files; verification files are not implementation access.',
		'Write only those files and Harness task-owned state or evidence. Do not update personal or agent memory.',
		...bugRepairPolicy(),
		`Task: ${task.title} (${task.id})`,
		task.instructions,
		role === 'verification'
			? 'Verify only the wanted contract below. A previous attempt may have left edits; inspect assigned files before changing them. Report verification performed and remaining gaps.'
			: 'Implement only the wanted contract below. A previous attempt may have left edits; inspect assigned files before changing them. Report verification performed and remaining gaps.',
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
			throw new Error(
				'Set an explicit model before provider or intelligence; auto owns both choices.'
			);
		return { provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'medium' };
	}
	const provider = task.provider ?? modelProvider(task.model);
	if (!provider) throw new Error('Set provider for this exact model id.');
	if (provider === 'claude' && task.intelligence === 'ultra')
		throw new Error('Claude does not support ultra intelligence.');
	return { provider, model: task.model, intelligence: task.intelligence ?? 'medium' };
}
function modelProvider(model: string): TaskSelection['provider'] | undefined {
	if (model.startsWith('claude-')) return 'claude';
	if (model.startsWith('gpt-')) return 'codex';
	return undefined;
}
