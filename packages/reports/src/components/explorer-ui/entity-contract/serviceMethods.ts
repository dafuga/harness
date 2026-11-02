import type { Recorded, ServiceClass, Item } from './serviceMethods.types';
import type { ContractGroup } from '../../../utils/explorer-ui/contractFields';
import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
import type { ContractRow } from '../../../utils/explorer-ui/entityContract';
import { methodsNamed, orderedMethods, within } from './methodNames';
import { fieldOf, returnField, typeLabel, type CallableContract } from './contractFields';

/** Whether a symbol, or a parameter, return or error, is declared under `Class.method`. */
function declares(unit: HarnessUnit, owner: string): boolean {
	const { inputs, outputs, errors } = unit.contract;
	return (
		unit.owns.symbols.includes(owner) ||
		inputs.some((item) => within(item.name, owner, false)) ||
		[...outputs, ...errors].some((item) => within(item.name, owner, true))
	);
}

/** Recorded classes with declared methods: same-named classes share one contract and CRUD order. */
function recordedClasses(unit: HarnessUnit, recorded: Recorded[]): ServiceClass[] {
	return [...new Set(recorded.map((found) => found.name))].flatMap((name) => {
		const listed = recorded
			.filter((found) => found.name === name)
			.flatMap((found) => found.methods.filter((method) => method !== 'constructor'));
		const built = declares(unit, `${name}.constructor`) ? ['constructor'] : [];
		const methods = orderedMethods([...built, ...listed]);
		const shown = methods.some((method) => declares(unit, `${name}.${method}`));
		return shown ? [{ name, methods }] : [];
	});
}

/** Legacy classes and methods come from qualified symbols and contract fields, never guesses. */
function namedClasses(unit: HarnessUnit): ServiceClass[] {
	const { inputs, outputs, errors } = unit.contract;
	const fields = [...inputs, ...outputs, ...errors].map((item) => item.name);
	const returns = outputs.map((item) => item.name);
	const owners = new Set(unit.owns.symbols.map((symbol) => symbol.split('.')[0]));
	return [...owners].flatMap((name) => {
		const declared = [
			...methodsNamed(unit.owns.symbols, name, true),
			...methodsNamed(fields, name, false)
		];
		if (declared.length === 0) return [];
		const methods = orderedMethods([...declared, ...methodsNamed(returns, name, true)]);
		return [{ name, methods }];
	});
}

/** One method's parameters, return and errors; multiple classes keep qualified method names. */
function methodContract(
	unit: HarnessUnit,
	of: string,
	method: string,
	qualified: boolean
): CallableContract {
	const owner = `${of}.${method}`;
	const name = qualified ? owner : method;
	const under = (items: Item[], whole: boolean) =>
		items.filter((item) => within(item.name, owner, whole));
	const parameters = under(unit.contract.inputs, false).map((item) => ({
		...fieldOf(item, unit),
		name: item.name.slice(owner.length + 1)
	}));
	const returns = under(unit.contract.outputs, true).map((item) =>
		returnField(item, typeLabel(item.type), owner, unit)
	);
	const errors = under(unit.contract.errors, true);
	const groups: ContractGroup[] = [
		{
			id: 'inputs',
			title: 'Parameters',
			none: 'No parameters.',
			fields: parameters,
			keepEmpty: true
		},
		{
			id: 'outputs',
			title: 'Returns',
			none: method === 'constructor' ? 'Creates the service.' : 'No return value declared.',
			fields: returns
		}
	];
	if (errors.length > 0)
		groups.push({
			id: 'errors',
			title: 'Throws',
			none: 'No errors declared for this method.',
			fields: errors.map((item) => fieldOf(item, unit)),
			hideNames: true
		});
	const args = parameters.map((field) => `${field.name}: ${field.type}`).join(', ');
	const type = returns[0]?.type;
	return {
		name,
		signature: `${name}(${args})${type ? `: ${type}` : ''}`,
		groups
	};
}

/** What a service contract declares under no one `Class.method`, said once beside its methods. */
function unscoped(unit: HarnessUnit, owners: string[]): ContractRow[] {
	const free = (items: Item[], whole: boolean) =>
		items.filter((item) => !owners.some((owner) => within(item.name, owner, whole)));
	const names = (items: Item[]) => [...new Set(items.map((item) => item.name))].join(', ');
	const { inputs, outputs, errors: failures } = unit.contract;
	const errors = names(free(failures, true));
	const others = names([...free(inputs, false), ...free(outputs, true)]);
	return [
		...(errors ? [{ label: 'Errors not tied to a method', value: errors }] : []),
		...(others ? [{ label: 'Fields not tied to a method', value: others }] : [])
	];
}

/** Per-class CRUD-first contracts, keeping qualified methods and unrelated facts distinct. */
export function serviceContract(unit: HarnessUnit): {
	methods: CallableContract[];
	facts: ContractRow[];
} {
	const classes = unit.serviceClasses
		? recordedClasses(unit, unit.serviceClasses)
		: namedClasses(unit);
	// Where a unit holds more than one class, each method is named with its class.
	const recorded = (unit.serviceClasses ?? classes).map((found) => found.name);
	const qualified = new Set(recorded).size > 1;
	const members = classes.flatMap(({ name, methods }) =>
		methods.map((method) => ({ of: name, method }))
	);
	const owners = members.map(({ of, method }) => `${of}.${method}`);
	return {
		methods: members.map(({ of, method }) => methodContract(unit, of, method, qualified)),
		facts: owners.length > 0 ? unscoped(unit, owners) : []
	};
}

/** Model declarations share the service method renderer, including static persistence methods. */
export function modelContract(unit: HarnessUnit): ReturnType<typeof serviceContract> {
	if (!unit.modelDefinitions) return serviceContract({ ...unit, serviceClasses: undefined });
	const all = unit.modelDefinitions;
	const declarations = all.some((item) => item.name === unit.title)
		? all.filter((item) => item.name === unit.title)
		: all;
	const methods = declarations.flatMap((item) =>
		item.methods.map((method) => ({
			...method,
			owner: `${item.name}.${method.name}`
		}))
	);
	const projected = serviceContract({
		...unit,
		owns: { ...unit.owns, symbols: methods.map((method) => method.owner) },
		serviceClasses: declarations.map((item) => ({
			name: item.name,
			source: item.source,
			methods: item.methods.map((method) => method.name),
			consumers: [],
			constructedBy: []
		})),
		contract: {
			inputs: methods.flatMap((method) =>
				method.inputs.map((input) => ({
					...input,
					...unit.contract.inputs.find((field) => field.name === `${method.owner}.${input.name}`),
					name: `${method.owner}.${input.name}`
				}))
			),
			outputs: methods
				.filter((method) => method.name !== 'constructor')
				.map((method) => ({
					name: `${method.owner}.returnValue`,
					type: method.output
				})),
			errors: unit.contract.errors
		}
	});
	return {
		...projected,
		methods: projected.methods.map((method) => ({
			...method,
			groups: method.groups.map((group) =>
				group.id === 'outputs' && /(?:^|\.)constructor$/.test(method.name)
					? { ...group, none: 'Creates the model.' }
					: group
			)
		}))
	};
}
