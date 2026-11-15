// @harness-uid u_adiz32coug
import type { SourceFile, ExportedSymbol } from '../../../../core/development-tooling/sourceTypes';
import type {
	ComponentManifest,
	ContractItem
} from '../../../../core/development-tooling/unitTypes';

/** Retain the legacy arrays while separating component props from exported script functions. */
export function deriveContract(files: SourceFile[], entry?: string): ComponentManifest['contract'] {
	const symbols = files.flatMap((file) => file.exports);
	const storage = files.flatMap((file) => file.storage ?? []);
	const primary = files
		.find((file) => file.path === entry)
		?.exports.find((symbol) => symbol.kind === 'component');
	const components = primary
		? [primary]
		: [
				...new Map(
					symbols
						.filter((symbol) => symbol.kind === 'component')
						.map((symbol) => [symbol.name, symbol])
				).values()
			];
	const outputs = symbols
		.filter(
			(symbol) =>
				symbol.output !== undefined &&
				!symbol.name.endsWith('.constructor') &&
				symbol.kind !== 'snippet'
		)
		.map((symbol) => ({ name: symbol.name, type: symbol.output ?? 'unknown' }));
	const errors = [...new Set(files.flatMap((file) => file.errors))].sort();
	const snippets = symbols
		.filter((symbol) => symbol.kind === 'snippet')
		.map((symbol) => ({ ...operationContract(symbol), errorStatus: 'none-found' as const }));
	return {
		origin: 'derived',
		errorStatus: errorStatus(symbols, errors),
		inputs: storage.length ? storageInputs(storage) : symbolInputs(symbols, components),
		outputs,
		...(storage.length ? { storage } : {}),
		errors: errors.map((name) => ({ name, type: 'thrown' })),
		...(snippets.length ? { snippets } : {}),
		operations: symbols
			.filter(
				(symbol) =>
					['function', 'method'].includes(symbol.kind) && !symbol.name.endsWith('.constructor')
			)
			.map(operationContract),
		initialization: symbols
			.filter((symbol) => symbol.name.endsWith('.constructor'))
			.map(operationContract)
	};
}

function errorStatus(symbols: ExportedSymbol[], errors: string[]) {
	if (symbols.some((symbol) => symbol.errorStatus === 'unknown')) return 'unknown' as const;
	return errors.length ? ('found' as const) : ('none-found' as const);
}

function symbolInputs(symbols: ExportedSymbol[], components: ExportedSymbol[]): ContractItem[] {
	const selected = components.length
		? components
		: symbols.filter((symbol) => symbol.kind !== 'snippet');
	return selected.flatMap((symbol) => symbol.inputs);
}

function storageInputs(
	models: NonNullable<ComponentManifest['contract']['storage']>
): ContractItem[] {
	return models.flatMap((model) =>
		model.fields.map((field) => ({
			name: `${model.name}.${field.name}`,
			type: field.type,
			required: field.required,
			...(Object.hasOwn(field, 'default') ? { default: field.default } : {})
		}))
	);
}

/** Authored explanations survive; readable source signatures supply flags and literal defaults. */
export function declaredContract(
	declared: ComponentManifest['contract'],
	source: ComponentManifest['contract']
): ComponentManifest['contract'] {
	return {
		...declared,
		inputs: source.inputs.map((item) => explainedItem(item, declared.inputs)),
		...(source.snippets ? { snippets: source.snippets } : {}),
		initialization: source.initialization?.map((operation) =>
			declaredOperation(operation, declared.initialization, declared)
		),
		...(source.storage ? { storage: source.storage } : {}),
		operations: source.operations?.map((operation) =>
			declaredOperation(operation, declared.operations, declared)
		)
	};
}

function declaredOperation(
	operation: NonNullable<ComponentManifest['contract']['operations']>[number],
	previous: ComponentManifest['contract']['operations'],
	contract: ComponentManifest['contract']
) {
	const authored = previous?.find((item) => item.name === operation.name);
	return {
		...operation,
		...declaredErrors(operation.name, previous),
		inputs: operation.inputs.map((item) =>
			explainedItem(item, authored?.inputs ?? [], contract.inputs)
		),
		outputs: operation.outputs.map((item) =>
			explainedItem(item, authored?.outputs ?? [], contract.outputs)
		)
	};
}

/** An authored operation's errors replace scanned ones; an empty list declares that none are thrown. */
function declaredErrors(
	name: string,
	declared: ComponentManifest['contract']['operations']
): Partial<NonNullable<ComponentManifest['contract']['operations']>[number]> {
	const authored = declared?.find((operation) => operation.name === name);
	if (authored?.errorStatus !== 'declared') return {};
	return { errors: authored.errors, errorStatus: 'declared' };
}

export function operationContract(symbol: ExportedSymbol) {
	return {
		name: symbol.name,
		inputs: symbol.inputs,
		outputs: symbol.output === undefined ? [] : [{ name: symbol.name, type: symbol.output }],
		errors: (symbol.errors ?? []).map((name) => ({ name, type: 'thrown' })),
		errorStatus: symbol.errorStatus ?? ('unknown' as const)
	};
}

function explainedItem(
	item: ContractItem,
	declared: ContractItem[],
	fallback: ContractItem[] = []
): ContractItem {
	const inherited = fallback.find((candidate) => candidate.name === item.name);
	const authored = declared.find((candidate) => candidate.name === item.name);
	const previous = { ...inherited, ...authored };
	if (previous.type === 'unknown' && inherited) previous.type = inherited.type;
	const documentation = { ...previous };
	delete documentation.default;
	// Preserve authored defaults when an optional prop has no source literal.
	const keepsAuthoredDefault =
		Object.hasOwn(previous, 'default') &&
		item.required === false &&
		!Object.hasOwn(item, 'default');
	return {
		...documentation,
		...item,
		...(keepsAuthoredDefault ? { default: previous.default } : {}),
		...(item.type === 'unknown' && previous.type ? { type: previous.type } : {})
	};
}
