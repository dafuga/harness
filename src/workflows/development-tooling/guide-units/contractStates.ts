import type { ComponentManifest, ContractItem } from '../../../core/development-tooling/unitTypes';
import type { UnitState } from './guideUnits.types';

/** @pure Infer reviewable boundaries without treating guesses as declared catalog states. */
export function contractStates(contract: ComponentManifest['contract']): UnitState[] {
	const states: UnitState[] = [];
	const add = (name: string, reason: string, origin: UnitState['origin'] = 'GUESS') => {
		if (!states.some((state) => state.name === name))
			states.push({ name, origin, reasons: [reason] });
	};
	for (const input of contract.inputs) propStates(input, add);
	const prose = [
		...contract.inputs,
		...contract.outputs,
		...contract.errors,
		...(contract.operations ?? []).flatMap((operation) => [
			...operation.inputs,
			...operation.outputs,
			...operation.errors
		])
	]
		.map((item) => `${item.name} ${item.description ?? ''}`)
		.join(' ')
		.toLowerCase();
	for (const [pattern, state] of [
		[/\bloading\b/, 'loading'],
		[/\bfail(?:ed|ure)?\b/, 'failed'],
		[/\berror\b/, 'error'],
		[/\bdisabled\b/, 'disabled'],
		[/\bempty\b/, 'empty'],
		[/\bunavailable\b/, 'unavailable'],
		[/\bplanned\b/, 'planned']
	] as const)
		if (pattern.test(prose)) add(state, `Contract mentions ${state}.`);
	if (/\b(?:list|array)\b/.test(prose))
		for (const size of ['none', 'one', 'many']) add(size, 'Contract describes a collection.');
	return states;
}

function propStates(
	input: ContractItem,
	add: (name: string, reason: string, origin?: UnitState['origin']) => void
) {
	const name = input.name.split('.').at(-1)!;
	const why = `Prop ${input.name} (${input.type}).`;
	if (input.required === false) {
		add(`without-${name}`, why);
		add(`with-${name}`, why);
	}
	if (/\bstring\b/.test(input.type)) add(`empty-${name}`, why);
	if (/\[\]|\b(?:ReadonlyArray|Array|Set|Map)</.test(input.type))
		for (const size of ['none', 'one', 'many']) add(`${name}-${size}`, why);
	if (/disabled/i.test(name)) add('disabled', why);
	if (/^show[A-Z]/.test(name) && input.type === 'boolean')
		add(`no-${name.slice(4).toLowerCase()}`, why);
	if (input.type.includes('|'))
		for (const match of input.type.matchAll(/['"]([\w-]+)['"]/g)) add(match[1], why, 'REQUIRED');
}

/** @pure Preserve declared order and upgrade a guessed boundary when a registry names it. */
export function mergeUnitStates(groups: UnitState[][]): UnitState[] {
	const merged = new Map<string, UnitState>();
	for (const state of groups.flat()) {
		const known = merged.get(state.name);
		merged.set(state.name, {
			...state,
			origin: known?.origin === 'REQUIRED' ? 'REQUIRED' : state.origin,
			reasons: [...new Set([...(known?.reasons ?? []), ...state.reasons])]
		});
	}
	return [...merged.values()];
}

/** @pure A scenario's catalog slot uses its exact entity prefix, never another unit's image. */
export function unitStateName(entity: string, state: string): string {
	const prefix = entity.replaceAll('.', '-');
	if (state === prefix || state === '') return 'default';
	return state.startsWith(`${prefix}-`) ? state.slice(prefix.length + 1) : state;
}
