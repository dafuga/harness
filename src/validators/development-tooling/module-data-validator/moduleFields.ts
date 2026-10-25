import type { ModuleIssue } from '../../../services/git-source-history/ModuleDataService.types';
import type { Unit } from './moduleFields.types';
export function moduleFields(unit: Unit, known: Set<string>): ModuleIssue[] {
	const issues: ModuleIssue[] = [];
	const add = (field: string, message: string, repair: string) =>
		issues.push({ field, message, repair });
	if (!unit.responsibility.trim())
		add('responsibility', 'Missing module goal.', 'Author the module responsibility.');
	if (!unit.owns.source.length)
		add('owns.source', 'No owned source.', 'Declare implementation files.');
	for (const source of unit.sourceFiles ?? [])
		if (source.gap)
			add('sourceFiles', `${source.path}: ${source.gap}`, 'Restore the owned source.');
	for (const edge of unit.dependencies)
		if (!known.has(edge.unit))
			add('dependencies', `Unknown dependency ${edge.unit}.`, 'Register the dependency.');

	return [...issues, ...contractFields(unit), ...helperFields(unit), ...sourceFigures(unit)];
}
function helperFields(unit: Unit): ModuleIssue[] {
	const issues: ModuleIssue[] = [];
	if (unit.helperGap)
		issues.push({
			field: 'helpers',
			message: unit.helperGap,
			repair: 'Restore the helper source.'
		});
	for (const helper of unit.helpers ?? [])
		if (helper.pure && (helper.consumers?.length ?? 0) > 1 && !helper.examples?.length)
			issues.push({
				field: `helpers.${helper.name}.examples`,
				message: 'Missing executable usage examples.',
				repair: 'Commit descriptive calls and expected results.'
			});
	return issues;
}
function sourceFigures(unit: Unit): ModuleIssue[] {
	return ['source-bytes', 'source-lines', 'complexity', 'dependencies'].flatMap((metric) => {
		const observation = unit.sourceMeasurements?.find((item) => item.metric === metric);
		if (observation?.value != null && !observation.partial) return [];
		return [
			{
				kind: observation ? ('evidence' as const) : ('metadata' as const),
				field: `measurements.${metric}`,
				message: observation
					? 'Source observation is partial or unavailable.'
					: 'Missing source observation metadata.',
				repair:
					'Run validate --write from the exact source revision; preserve unavailable-counter reasons.'
			}
		];
	});
}

function contractFields(unit: Unit): ModuleIssue[] {
	const issues: ModuleIssue[] = [];
	const add = (field: string, message: string, repair: string) =>
		issues.push({ field, message, repair });
	for (const field of ['inputs', 'outputs', 'errors'] as const) {
		if (!Array.isArray(unit.contract[field]))
			add(
				`contract.${field}`,
				'Missing contract section; declare [] for none.',
				'Commit the wanted contract.'
			);
		for (const item of unit.contract[field] ?? [])
			if (!item.name?.trim() || !item.type?.trim())
				add(
					`contract.${field}`,
					'Contract item needs a name and type.',
					'Complete the contract item.'
				);
	}
	return issues;
}
