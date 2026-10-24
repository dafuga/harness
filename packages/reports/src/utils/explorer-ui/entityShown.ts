import type { Shown } from './entityShown.types';
import type { ExplorerEntity, ExplorerRelations } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';
import {} from './entityContract';
import {} from './entityMeasure';
import { entityReasons, type EntityReasons } from './entityReasons';
import { explorerEntity } from './explorerEntities';

/** What the shown commit itself says it changed in one entity, held to the length of a reason. */
export function entityChanged(host: Pick<Shown, 'head'>, unit: string): EntityReasons {
	return entityReasons(host.head.explanations.filter((item) => item.unit === unit));
}

export { entityShown } from '../../components/explorer-ui/entity-sections/entityShown';

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
			...(helper.group ? { group: helper.group } : {}),
			title: helperName,
			helpers: [helper],
			...(unit.sourceFiles
				? { sourceFiles: unit.sourceFiles.filter((file) => file.path === helper.source) }
				: {}),
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

/** A selected helper uses only callees attributed to that named function at this revision. */
export function helperRelations(
	host: Pick<ExplorerScreenProps, 'head' | 'route'>,
	entity: ExplorerEntity,
	relations: ExplorerRelations
): ExplorerRelations {
	const caller = host.route.helper;
	if (!caller || entity.category !== 'functions') return relations;
	const functions = host.head.registry.units.flatMap((unit) => {
		if (unit.status !== 'active') return [];
		const helpers =
			unit.helpers?.filter(
				(helper) =>
					helper.pure === true &&
					!(unit.id === entity.id && helper.name === caller) &&
					helper.consumers?.some((user) => user.unit === entity.id && user.symbol === caller)
			) ?? [];
		if (!helpers.length) return [];
		const target = explorerEntity(host.head, unit, true);
		if (!target || target.category !== 'functions') return [];
		const narrowed = { ...target, unit: { ...unit, helpers } };
		return [helpers.length === 1 ? helperEntity(target, helpers[0].name)! : narrowed];
	});
	return {
		...relations,
		layouts: [],
		components: [],
		functions,
		services: [],
		configs: [],
		models: [],
		types: [],
		support: []
	};
}

export type { EntityShown, Shown } from './entityShown.types';
