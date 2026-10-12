import type { HarnessScenario, HarnessUnit } from '../models/Harness.types';
import type { ExplorerCategory } from '../models/Explorer.types';
import { scenarioFor } from './explorerState';

export interface ContractRow {
	label: string;
	value: string;
	/** What each named item is, where the contract says so in words; a derived one does not. */
	items?: Array<{ name: string; text: string }>;
}

export interface ContractFacts {
	category: ExplorerCategory;
	/** The web address of a page; null when the history records none. */
	appRoute?: string | null;
	/** The states the entity has to be proven in. */
	states?: string[];
}

const targets: Record<string, string> = {
	module: 'Module',
	wasm: 'Wasm',
	process: 'Native process',
	http: 'HTTP'
};

/** An identifier of any casing as the words it is made of. */
export function humanize(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.replace(/[_\-.]+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * The states a unit has to be proven in: the required states of the scenarios that name it, as
 * each applies to the unit. Which states of a scenario show a unit is the host's one answer
 * (`scenarioFor`), read with the units of the same registry, so the states listed are those its
 * proof judges and its captures are picked from. What that answer cannot narrow stays whole.
 */
export function requiredStates(
	unit: HarnessUnit,
	scenarios: HarnessScenario[],
	units: HarnessUnit[]
): string[] {
	const states = scenarios
		.filter((scenario) => scenario.units.includes(unit.id))
		.flatMap((scenario) => scenarioFor(scenario, unit.id, units).states)
		.filter((state) => state.coverage === 'required')
		.map((state) => state.id);
	return [...new Set(states)];
}

type Field = HarnessUnit['contract']['inputs'];

/** The names a unit goes by itself: its title, its symbols and its files without their endings. */
function own(unit: HarnessUnit): string[] {
	const files = unit.owns.source.map((path) => path.slice(path.lastIndexOf('/') + 1).split('.')[0]);
	return [unit.title, ...unit.owns.symbols, ...files];
}

/**
 * One row of a contract: its items by name, and what each is where the contract says so. A name
 * says `Owner.name`, and the owner is not repeated. What a component draws is derived under the
 * name of the component or of its file, which says nothing: it reads rendered markup. An output
 * a contract declares keeps the name it was given.
 */
function row(label: string, fields: Field, none: string, unit?: HarnessUnit): ContractRow {
	const names = fields.map((field) => {
		const name = field.name.slice(field.name.lastIndexOf('.') + 1);
		const itself = field.type === 'markup' && unit !== undefined && own(unit).includes(name);
		return itself ? 'rendered markup' : humanize(name);
	});
	const items = fields.flatMap((field, position) =>
		field.description ? [{ name: names[position], text: field.description }] : []
	);
	const value = [...new Set(names)].join(', ') || none;
	return { label, value, ...(items.length > 0 ? { items } : {}) };
}

function runsAs(unit: HarnessUnit): string {
	const kinds = unit.runtime.targets.map((target) => targets[target.kind] ?? target.kind);
	return [...new Set(kinds)].join(', ') || (targets[unit.runtime.kind] ?? unit.runtime.kind);
}

function pageRows(unit: HarnessUnit, facts: ContractFacts): ContractRow[] {
	const { inputs, outputs, errors } = unit.contract;
	return [
		{ label: 'Purpose', value: unit.responsibility },
		{ label: 'App route', value: facts.appRoute || 'Not recorded' },
		row('Inputs', inputs, 'None'),
		row('Output', outputs, 'Nothing declared', unit),
		// What a page says or does when it cannot show what was asked, once its contract says it.
		...(errors.length > 0 ? [row('Fails with', errors, 'Nothing declared')] : []),
		{ label: 'Required states', value: facts.states?.join(', ') || 'None declared' }
	];
}

/**
 * The contract of an entity as a person reads it: what it takes, what it gives and how it may
 * fail, in words. A page adds its purpose, its web address and the states it has to be proven
 * in; a config says what it provides; a service says how it runs. No row holds a file, a symbol
 * or a type expression.
 */
export function entityContract(unit: HarnessUnit, facts: ContractFacts): ContractRow[] {
	if (facts.category === 'pages') return pageRows(unit, facts);
	const { inputs, outputs, errors } = unit.contract;
	if (facts.category === 'configs') {
		return [
			{ label: 'Purpose', value: unit.responsibility },
			row('Provides', outputs, 'Nothing declared', unit)
		];
	}
	const rows: ContractRow[] = [
		row('Inputs', inputs, 'None'),
		row('Output', outputs, 'Nothing declared', unit),
		row('Fails with', errors, 'Nothing declared')
	];
	if (facts.category === 'services') rows.push({ label: 'Runs as', value: runsAs(unit) });
	if (facts.states?.length) rows.push({ label: 'States', value: facts.states.join(', ') });
	return rows;
}
