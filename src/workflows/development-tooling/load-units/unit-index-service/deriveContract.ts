import type { SourceFile } from '../../../../core/development-tooling/sourceTypes';
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
		inputs: (components.length
			? components
			: symbols.filter((symbol) => symbol.kind !== 'snippet')
		).flatMap((symbol) => symbol.inputs),
		outputs,
		errors: errors.map((name) => ({ name, type: 'thrown' })),
		...(snippets.length ? { snippets } : {})
	};
}

/** Authored explanations survive; readable source signatures supply flags and literal defaults. */
export function declaredContract(
	declared: ComponentManifest['contract'],
	source: ComponentManifest['contract']
): ComponentManifest['contract'] {
	return {
		...declared,
		inputs: declared.inputs.map((item) => {
			const found = source.inputs.find((input) => input.name === item.name);
			return found
				? {
						...item,
						required: found.required,
						...(Object.hasOwn(found, 'default') ? { default: found.default } : {})
					}
				: item;
		}),
		...(source.snippets ? { snippets: source.snippets } : {})
	};
}
