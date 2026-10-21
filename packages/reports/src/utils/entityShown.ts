import type { ExplorerEntity } from '../models/Explorer.types';
import type { ExplorerScreenProps } from '../models/ExplorerScreen.types';
import type { HarnessRecord, HarnessUnit } from '../models/Harness.types';
import { type ContractRow } from './entityContract';
import { type EntityMeasure } from './entityMeasure';
import { entityReasons, type EntityReasons } from './entityReasons';

export interface EntityShown {
	contract: ContractRow[];
	measure: EntityMeasure;
	/** Full-verification verdict only; focused observations retain their original revision separately. */
	record: HarnessRecord | null;
}

export type Shown = Pick<ExplorerScreenProps, 'head' | 'parent'>;

/** What the shown commit itself says it changed in one entity, held to the length of a reason. */
export function entityChanged(host: Pick<Shown, 'head'>, unit: string): EntityReasons {
	return entityReasons(host.head.explanations.filter((item) => item.unit === unit));
}

export { entityShown } from '../components/harness/entity-sections/entityShown';

/** Select one callable's API without inventing a new unit or borrowing sibling declarations. */
export function helperEntity(
	owner: ExplorerEntity | undefined,
	helperName?: string
): ExplorerEntity | undefined {
	if (!owner || !helperName) return owner;
	if (owner.category !== 'functions') return undefined;
	const unit = owner.unit;
	const helper = unit.helpers?.find((candidate) => candidate.name === helperName);
	if (!helper) return undefined;
	const output = unit.contract.outputs.find(
		(field) => field.name === helperName || field.name.startsWith(`${helperName}.`)
	);
	return {
		...owner,
		name: helperName,
		purpose: output?.description ?? `Helper defined in ${unit.title}.`,
		unit: {
			...unit,
			title: helperName,
			helpers: [helper],
			owns: { source: [helper.source], symbols: [helperName] },
			contract: helperFields(unit, helperName),
			documentation: helperDocumentation(unit, helper)
		}
	};
}

function helperDocumentation(
	unit: HarnessUnit,
	helper: NonNullable<HarnessUnit['helpers']>[number]
) {
	if (helper.examples?.length) return { path: '', examples: helper.examples };
	if (unit.helpers?.length === 1) return unit.documentation;
	return undefined;
}

/** Field ownership is decided against the original module, before its helper list is narrowed. */
function helperFields(unit: HarnessUnit, helperName: string): HarnessUnit['contract'] {
	const only = unit.helpers?.length === 1;
	return {
		inputs: unit.contract.inputs.filter((field) => field.name.startsWith(`${helperName}.`)),
		outputs: unit.contract.outputs.filter(
			(field) => field.name === helperName || field.name.startsWith(`${helperName}.`)
		),
		errors: unit.contract.errors.filter((field) => only || field.name.startsWith(`${helperName}.`))
	};
}
