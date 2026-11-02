// @harness-uid u_bine3tddnk
import type { SourceIndex } from '../../../../services/development-tooling/source-index-service/SourceIndexService';
import type { ComponentManifest } from '../../../../core/development-tooling/unitTypes';

/** Merge model companions while retaining their old identities as explicit retired records. */
export function modelCompanions(
	index: SourceIndex,
	existing: ComponentManifest[]
): ComponentManifest[] {
	const redirects = new Map<string, string>();
	const models = existing.filter((unit) => unit.status === 'active' && unit.kind === 'model');
	for (const companion of models) {
		if (companion.owns.source.length !== 1 || !companion.owns.source[0].endsWith('.types.ts'))
			continue;
		const implementation = companion.owns.source[0].replace(/\.types\.ts$/, '.ts');
		const owner = models.find(
			(unit) => unit.id !== companion.id && unit.owns.source.includes(implementation)
		);
		if (owner && index.files.get(implementation)?.storage?.length)
			redirects.set(companion.id, owner.id);
	}
	return existing.map((unit) => {
		const owner = redirects.get(unit.id);
		if (owner)
			return {
				...unit,
				status: 'retired',
				retired: { reason: `Type companion merged into ${owner}.`, at: index.revision }
			};
		const companions = models.filter((item) => redirects.get(item.id) === unit.id);
		return {
			...unit,
			...(companions.length
				? {
						owns: {
							...unit.owns,
							source: [
								...new Set([...unit.owns.source, ...companions.flatMap((item) => item.owns.source)])
							].sort()
						},
						lineage: {
							predecessors: [
								...new Set([
									...(unit.lineage?.predecessors ?? []),
									...companions.map((item) => item.id)
								])
							].sort()
						}
					}
				: {}),
			dependencies: unit.dependencies.flatMap((dependency) => {
				const target = redirects.get(dependency.unit);
				return target === unit.id ? [] : [{ ...dependency, unit: target ?? dependency.unit }];
			})
		};
	});
}
