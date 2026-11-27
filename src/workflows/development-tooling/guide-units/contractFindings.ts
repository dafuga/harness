// @harness-uid u_xeepnh3rwx
import type { ComponentManifest, ContractItem } from '../../../core/development-tooling/unitTypes';
import type { ContractFinding, ContractScope } from './guideUnits.types';

const leaf = (name: string) => name.split('.').at(-1);

/** @pure Compare stored documentation with the existing indexer's unmerged source contract. */
export function contractFindings(
	unit: ComponentManifest,
	source: ComponentManifest['contract']
): ContractFinding[] {
	const found: ContractFinding[] = [];
	const add = (kind: ContractFinding['kind'], detail: string, where: string) =>
		found.push({ entity: unit.id, kind, detail, where });
	for (const scope of contractScopes(unit.contract))
		found.push(...scopeFindings(unit, scope, source.outputs.length > 0));
	const declaredInputs = contractScopes(unit.contract).flatMap((scope) => scope.contract.inputs);
	for (const input of source.inputs)
		if (!declaredInputs.some((item) => leaf(item.name) === leaf(input.name)))
			add(
				'undocumented-prop',
				`Source input ${input.name} is absent from the contract.`,
				unit.runtime.entry
			);
	for (const scope of contractScopes(source)) compareSourceScope(unit, scope, add);
	return uniqueFindings(found);
}

function scopeFindings(unit: ComponentManifest, scope: ContractScope, executable: boolean) {
	const where = `specification/units/${unit.id}.json#contract${scope.name ? '.' + scope.name : ''}`;
	const found = scope.contract.inputs.flatMap((input) => inputFindings(unit.id, input, where));
	const label = scope.name || unit.title;
	if (!scope.contract.errorStatus || scope.contract.errorStatus === 'unknown')
		found.push({
			entity: unit.id,
			kind: 'missing-errors',
			detail: `${label} has no documented error outcome. Declare errors or explicitly declare none.`,
			where
		});
	if (!scope.contract.outputs.length && (scope.name || executable))
		found.push({
			entity: unit.id,
			kind: 'missing-output',
			detail: `${label} has no documented function/snippet output (void is an output).`,
			where
		});
	return found;
}

function inputFindings(entity: string, input: ContractItem, where: string): ContractFinding[] {
	const findings: ContractFinding[] = [];
	if (input.required === undefined)
		findings.push({
			entity,
			kind: 'missing-required',
			detail: `${input.name} does not declare required or optional.`,
			where
		});
	if (input.required === false && !input.defaultKind && !Object.hasOwn(input, 'default'))
		findings.push({
			entity,
			kind: 'missing-default',
			detail: `${input.name} is optional without a documented default (including explicit null).`,
			where
		});
	return findings;
}

function compareSourceScope(
	unit: ComponentManifest,
	source: ContractScope,
	add: (kind: ContractFinding['kind'], detail: string, where: string) => void
) {
	const declared = contractScopes(unit.contract).find(
		(scope) => scope.name === source.name || (source.name && leaf(scope.name) === leaf(source.name))
	);
	const errors = declared?.contract.errors ?? [];
	for (const error of source.contract.errors)
		if (!errors.some((item) => item.name === error.name || item.type === error.name))
			add(
				'missing-errors',
				`${source.name || unit.title} uses ${error.name}, absent from its documented errors.`,
				unit.runtime.entry
			);
	if (source.name && source.contract.outputs.length && !declared?.contract.outputs.length)
		add(
			'missing-output',
			`Source function/snippet ${source.name} has no documented output.`,
			unit.runtime.entry
		);
}

export function contractScopes(contract: ComponentManifest['contract']): ContractScope[] {
	return [
		{ name: '', contract },
		...[
			...(contract.operations ?? []),
			...(contract.initialization ?? []),
			...(contract.snippets ?? [])
		].map((operation) => ({ name: operation.name, contract: operation }))
	];
}

function uniqueFindings(found: ContractFinding[]) {
	return [...new Map(found.map((finding) => [JSON.stringify(finding), finding])).values()];
}

/** @pure Documentation can name a source state directly or describe its failure outcome. */
export function documentsState(items: ContractItem[], state: string): boolean {
	const words = items
		.map((item) => `${item.name} ${item.type} ${item.description ?? ''}`)
		.join(' ')
		.toLowerCase();
	const forms = state === 'failed' ? ['failed', 'failure', 'fail'] : [state];
	return forms.some((form) => words.split(/[^a-z0-9-]+/).includes(form.toLowerCase()));
}
