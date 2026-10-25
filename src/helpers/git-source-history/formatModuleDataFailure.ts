import type {
	ModuleData,
	ModuleValidation
} from '../../services/git-source-history/ModuleDataService.types';
/** @pure Format scoped module-data gaps as a repair message; complete metadata has no error. */
export function formatModuleDataFailure(
	data: Pick<ModuleData, 'commit' | 'modules' | 'issues'>,
	module?: string
): string | null {
	const modules = module ? data.modules.filter((unit) => unit.id === module) : data.modules;
	const issues = [
		...data.issues,
		...(module && !modules.length ? [`Unknown module: ${module}`] : []),
		...modules.flatMap(moduleFailures)
	];
	if (!issues.length) return null;
	return `Incomplete module data for ${data.commit}. Run harness validate${module ? ` --module ${module}` : ''} --commit ${data.commit} --json. ${issues.slice(0, 8).join(' ')}`;
}
/** @pure */
function moduleFailures(unit: ModuleValidation): string[] {
	return unit.issues
		.filter((issue) => issue.kind !== 'evidence')
		.map((issue) => `${unit.id}: ${issue.field}: ${issue.message}`);
}
