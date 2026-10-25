import type { UnitDocumentation } from '../../../utils/explorer-ui/unit-documentation/unitDocumentation';
import { readUnitDocumentation } from '../../../utils/explorer-ui/unit-documentation/unitDocumentation';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';

/** Fill prebuilt entity views once from their exact source tree. */
export async function hydrateUnitDocumentation(
	tree: Pick<SourceTree, 'read'>,
	units: Array<{
		id: string;
		documentation?: UnitDocumentation;
		testing?: ComponentManifest['testing'];
	}>
): Promise<void> {
	await Promise.all(
		units.map(async (unit) => {
			const path = unit.documentation?.path;
			if (!path && unit.testing?.examples?.length)
				unit.documentation = {
					path: '',
					examples: unit.testing.examples.map(usageOfTestExample)
				};
			if (path)
				unit.documentation = await readUnitDocumentation(tree, {
					id: unit.id,
					documentation: path
				});
		})
	);
}

function usageOfTestExample(
	item: NonNullable<NonNullable<ComponentManifest['testing']>['examples']>[number]
) {
	const example = { name: `${item.subject}: ${item.name}`, call: item.call, input: item.input };
	if (item.expected.kind === 'void') return { ...example, returns: 'void' as const };
	if (item.expected.kind === 'error') return { ...example, error: item.expected.value };
	return { ...example, output: item.expected.value };
}
