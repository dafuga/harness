import { UnitDocumentation, readUnitDocumentation } from '../../utils/unit-documentation/unitDocumentation';
import type { SourceTree } from "../../core/sourceTypes";

/** Fill prebuilt entity views once from their exact source tree. */
export async function hydrateUnitDocumentation(
	tree: Pick<SourceTree, 'read'>,
	units: Array<{ id: string; documentation?: UnitDocumentation }>
): Promise<void> {
	await Promise.all(
		units.map(async (unit) => {
			const path = unit.documentation?.path;
			if (path)
				unit.documentation = await readUnitDocumentation(tree, {
					id: unit.id,
					documentation: path
				});
		})
	);
}
