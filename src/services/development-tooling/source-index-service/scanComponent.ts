// @harness-uid u_pv45ayumau
import type { ExportedSymbol } from '../../../core/development-tooling/sourceTypes';
import { scanExports, type ExportScan } from '../../../utils/development-tooling/scanExports';
import { svelteScripts } from '../../../utils/development-tooling/scanImports';
import {
	boundProps,
	componentSnippets,
	componentSource,
	localProps,
	propsDeclaration,
	propsType
} from './componentSyntax';

/** Describes instance props independently of module exports and locally declared snippets. */
export function scanComponent(code: string, name: string): ExportScan {
	const nested = svelteScripts(code).map((script) => scanExports(script));
	const file = componentSource(code);
	const props = propsDeclaration(file);
	const inputs = props ? boundProps(localProps(propsType(props), file), props, name) : [];
	const component: ExportedSymbol = {
		name,
		kind: 'component',
		inputs:
			props && !inputs.length && propsType(props)?.getText() !== '{}'
				? [
						{
							name: `${name}.props`,
							type: propsType(props)?.getText() ?? 'unknown',
							required: true
						}
					]
				: inputs,
		output: 'markup'
	};
	return {
		symbols: [
			component,
			...nested.flatMap((scan) => scan.symbols),
			...componentSnippets(code, name)
		],
		errors: [...new Set(nested.flatMap((scan) => scan.errors))].sort()
	};
}
