import type { SourceFile, ExportedSymbol } from '../../../../core/development-tooling/sourceTypes';
import type {
	ComponentManifest,
	ContractItem
} from '../../../../core/development-tooling/unitTypes';

/** Retain the legacy arrays while separating component props from exported script functions. */
export function deriveContract(files: SourceFile[]): ComponentManifest['contract'] {
	const symbols = files.flatMap((file) => file.exports);
	const components = symbols.filter((symbol) => symbol.kind === 'component');
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
		.map((symbol) => ({
			name: symbol.name,
			inputs: symbol.inputs,
			outputs: [{ name: symbol.name, type: 'markup' }],
			errors: [],
			errorStatus: 'none-found' as const
		}));
	return {
		origin: 'derived',
		errorStatus: symbols.some((symbol) => symbol.errorStatus === 'unknown')
			? 'unknown'
			: errors.length
				? 'found'
				: 'none-found',
		inputs: (components.length
			? components
			: symbols.filter((symbol) => symbol.kind !== 'snippet')
		).flatMap((symbol) => symbol.inputs),
		outputs,
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

/** Authored explanations survive; readable source signatures supply flags and literal defaults. */
export function declaredContract(
	declared: ComponentManifest['contract'],
	source: ComponentManifest['contract']
): ComponentManifest['contract'] {
	return {
		...declared,
		inputs: source.inputs.map((item) => explainedItem(item, declared.inputs)),
		...(source.snippets ? { snippets: source.snippets } : {}),
		initialization: source.initialization,
		operations: source.operations?.map((operation) => ({
			...operation,
			inputs: operation.inputs.map((item) => explainedItem(item, declared.inputs)),
			outputs: operation.outputs.map((item) => explainedItem(item, declared.outputs))
		}))
	};
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

function explainedItem(item: ContractItem, declared: ContractItem[]): ContractItem {
	const previous = declared.find((candidate) => candidate.name === item.name);
	const { default: _default, ...documentation } = previous ?? {};
	return {
		...documentation,
		...item,
		...(item.type === 'unknown' && previous ? { type: previous.type } : {})
	};
}
