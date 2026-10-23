import postcss from 'postcss';
import { namedCssColors } from './namedCssColors';
import { parse } from 'svelte/compiler';
import { appStyleTokensConfig as config } from '../../../src/configs/shared-primitives/appStyleTokensConfig';

/** Inspect design declarations, including literal inline styles, without changing layout CSS. */
export function styleTokenViolations(source: string, path: string): string[] {
	const issues: string[] = [];
	const inspect = (css: string) => inspectDeclarations(css, path, issues);
	if (path.endsWith('.css')) inspect(source);
	else {
		const ast = parse(source);
		if (ast.css) inspect(ast.css.content.styles);
		const walk = (node: unknown): void => {
			if (!node || typeof node !== 'object') return;
			const item = node as Record<string, unknown>;
			const inline = inlineStyle(item);
			if (inline) inspect(`inline {${inline}}`);
			for (const child of Object.values(item)) {
				if (Array.isArray(child)) child.forEach(walk);
				else if (child && typeof child === 'object') walk(child);
			}
		};
		walk(ast.html);
	}
	return issues;
}

function inspectDeclarations(css: string, path: string, issues: string[]): void {
	postcss.parse(css).walkDecls((declaration) => {
		const { prop, value } = declaration;
		if (path === config.tokenFile) return;
		if (!prop.startsWith('--') && !config.designProperties.test(prop)) return;
		const remaining = withoutVariables(value);
		if (prop.startsWith('--hx-') && remaining.trim()) {
			issues.push(`${path}: public token override outside catalog: ${prop}: ${value}`);
			return;
		}
		if (literalDesign(prop.includes('font-family') ? 'font-family' : prop, remaining))
			issues.push(`${path}: ${prop}: ${value}`);
	});
}

/** Remove references while retaining their fallbacks so a literal fallback cannot hide debt. */
function withoutVariables(value: string): string {
	let previous = '';
	while (previous !== value) {
		previous = value;
		value = value.replace(/var\(\s*--[\w-]+\s*(?:,\s*([^()]*))?\)/g, '$1');
	}
	return value;
}

function literalDesign(property: string, value: string): boolean {
	value = value.replace(/url\([^)]*\)/g, '');
	if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(/i.test(value)) return true;
	if (namedCssColors.test(value)) return true;
	if (/filter$/.test(property) && /\(\s*[^)\s]/.test(value)) return true;
	if (
		/^(?:transition|animation)/.test(property) &&
		/\b(?:linear|ease(?:-in|-out|-in-out)?|step-start|step-end)\b/.test(value)
	)
		return true;
	if (
		/(?:^|[^\w-])-?(?:\d*\.)?\d+(?:px|rem|em|ch|ms|s)\b/.test(
			value.replace(/(?<![\d.])0(?:px|rem|em|ch|ms|s)\b/g, '0')
		)
	)
		return true;
	return typographyOrScalar(property, value);
}

function typographyOrScalar(property: string, value: string): boolean {
	if (
		/^(?:font-weight|line-height|opacity|z-index)$/.test(property) &&
		/(?:^|\s)(?!0(?:\s|$))(?:\d|\.\d)/.test(value)
	)
		return true;
	if (property === 'border-radius' && /[1-9][\d.]*%/.test(value)) return true;
	if (config.typographyProperties.test(property))
		return Boolean(
			value.trim().replace(/\b(?:inherit|initial|unset|revert(?:-layer)?)\b|[\s,0]/g, '')
		);
	return false;
}

/** Literal style directives and SVG paints follow the same rules as stylesheets. */
function inlineStyle(item: Record<string, unknown>): string | undefined {
	if (!['Attribute', 'StyleDirective'].includes(String(item.type)) || !Array.isArray(item.value))
		return;
	const parts = item.value as Array<{ type: string; data?: string }>;
	if (!parts.every((part) => part.type === 'Text')) return;
	const value = parts.map((part) => part.data).join('');
	if (item.type === 'StyleDirective') return `${String(item.name)}:${value}`;
	if (item.name === 'style') return value;
	if (['fill', 'stroke', 'color'].includes(String(item.name)))
		return `${String(item.name)}:${value}`;
}

/** CSS variables cannot occur in query conditions; compare their literal thresholds to the catalog. */
export function responsiveThresholds(source: string, path: string): number[] {
	const css = path.endsWith('.css') ? source : (parse(source).css?.content.styles ?? '');
	const widths: number[] = [];
	postcss.parse(css).walkAtRules(/^(?:media|container)$/, (rule) => {
		for (const match of rule.params.matchAll(/(?:min|max)-(?:width|height):\s*(\d+)px/g))
			widths.push(Number(match[1]));
	});
	return widths;
}
