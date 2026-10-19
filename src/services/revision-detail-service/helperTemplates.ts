import { parse } from "svelte/compiler";
import { svelteScripts } from "../../utils/scanImports";

type Node = { type?: string; start?: number; end?: number; [key: string]: unknown };

function bindingNames(value: unknown): string[] {
	if (!value || typeof value !== 'object') return [];
	const node = value as Node;
	if (node.type === 'Identifier') return [String(node.name)];
	if (node.type === 'Property') return bindingNames(node.value);
	return Object.entries(node).flatMap(([key, item]) => {
		if (['start', 'end', 'loc', 'type', 'key'].includes(key)) return [];
		return Array.isArray(item) ? item.flatMap(bindingNames) : bindingNames(item);
	});
}

function templateUses(node: Node, code: string, bound: string[]): string[] {
	const found: string[] = [];
	const expression = node.expression as Node | undefined;
	if (expression?.start !== undefined && expression.end !== undefined) {
		const text = code.slice(expression.start, expression.end);
		found.push(`function __template(${bound.join(',')}) { void (${text}); }`);
	}
	const local = ['context', 'parameters'].flatMap((key) => bindingNames(node[key]));
	const scope = [...bound, ...local];
	for (const [key, value] of Object.entries(node)) {
		if (['expression', 'context', 'parameters', 'metadata'].includes(key)) continue;
		const children = Array.isArray(value) ? value : [value];
		for (const child of children) {
			if (child && typeof child === 'object')
				found.push(...templateUses(child as Node, code, scope));
		}
	}
	return found;
}

/** Parse real Svelte expressions; plain markup text and strings never become helper uses. */
export function helperTemplates(code: string): string {
	const root = parse(code, { modern: true });
	return [...svelteScripts(code), ...templateUses(root.fragment as unknown as Node, code, [])].join(
		'\n'
	);
}
