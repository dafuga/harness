import type { ModuleRelationships } from '../ModuleDataService.types';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import { committedModuleData, moduleDataRequired } from './moduleDataAdmission';
export async function preparedModuleData(root: string, commit: string) {
	const required = await moduleDataRequired(root, commit),
		stored = await committedModuleData(root, commit);
	if (!stored)
		return {
			required,
			committed: false as const,
			commit,
			issues: ['Missing or stale committed module data; run harness validate --write.'],
			modules: [],
			relationships: {} as Record<string, ModuleRelationships>
		};
	const { digest, modules, issues, relationships } = stored.data;
	return { required, committed: true as const, commit, digest, modules, issues, relationships };
}
export async function committedRegistry(root: string, commit: string, fallback: RevisionRegistry) {
	const stored = await committedModuleData(root, commit);
	return stored?.data.registry ?? fallback;
}
