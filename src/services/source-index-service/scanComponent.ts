import type { ExportedSymbol } from '../../core/sourceTypes';
import type { ContractItem } from '../../core/unitTypes';
import { maskSource } from '../../utils/maskSource';
import { normalizeType, parseParameters } from '../../utils/parseParameters';
import { scanExports, type ExportScan } from '../../utils/scanExports';
import { svelteScripts } from '../../utils/scanImports';

const propsPattern = /\blet\s+(?:\{[^}]*\}|[\w$]+)\s*(?::([\s\S]*?))?=\s*\$props\s*\(/;

/** Describes a Svelte component: its props are inputs and its markup is the output. */
export function scanComponent(code: string, name: string): ExportScan {
	const scripts = svelteScripts(code);
	const nested = scripts.map((script) => scanExports(script));
	const component: ExportedSymbol = {
		name,
		kind: 'component',
		inputs: scripts.flatMap((script) => componentProps(script, name)),
		output: 'markup'
	};
	return {
		symbols: [component, ...nested.flatMap((scan) => scan.symbols)],
		errors: [...new Set(nested.flatMap((scan) => scan.errors))].sort()
	};
}

function componentProps(script: string, name: string): ContractItem[] {
	const masked = maskSource(script);
	const match = propsPattern.exec(masked);
	if (!match) return [];
	if (match[1] === undefined) return [{ name: `${name}.props`, type: 'unknown' }];
	const start = match.index + match[0].indexOf(match[1]);
	const type = script.slice(start, start + match[1].length).trim();
	const open = match[1].indexOf('{');
	if (!match[1].trim().startsWith('{'))
		return [{ name: `${name}.props`, type: normalizeType(type) }];
	const from = start + open + 1;
	const to = start + match[1].lastIndexOf('}');
	return parseParameters(script.slice(from, to), masked.slice(from, to), {
		owner: name,
		separators: ';,'
	});
}
