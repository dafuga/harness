// Conforming HTML elements: https://html.spec.whatwg.org/multipage/indices.html#elements-3
// SVG and dynamic elements preserve the existing native drawing and heading APIs.
export const htmlElements = `a abbr address area article aside audio b base bdi bdo
blockquote body br button canvas caption cite code col colgroup data datalist dd del
details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2
h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li
link main map mark menu meta meter nav noscript object ol optgroup option output p
picture pre progress q rp rt ruby s samp script search section select selectedcontent
slot small source span strong style sub summary sup table tbody td template textarea
tfoot th thead time title tr track u ul var video wbr`.split(/\s+/);

export const svgElements = `svg path circle ellipse line polyline polygon rect g defs
symbol use text tspan textPath image clipPath mask linearGradient radialGradient stop
pattern marker foreignObject filter feGaussianBlur feOffset feBlend feColorMatrix
feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap
feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR feImage feMerge
feMergeNode feMorphology fePointLight feSpecularLighting feSpotLight feTile feTurbulence
animate animateMotion animateTransform mpath set desc`.split(/\s+/);

export const inputTypes = `button checkbox color date datetime-local email file hidden image
month number password radio range reset search submit tel text time url week`.split(/\s+/);

export const voidElements = new Set(
	'area base br col embed hr img input link meta source track wbr'.split(' ')
);

export function elementName(tag) {
	return 'Html' + tag.replace(/(^|-)([a-z])/g, (_match, _dash, letter) => letter.toUpperCase());
}

export const nativeAtoms = [
	...htmlElements.map((tag) => ({ name: elementName(tag), tag })),
	...svgElements.map((tag) => ({ name: 'Svg' + tag[0].toUpperCase() + tag.slice(1), tag })),
	...inputTypes.map((type) => ({ name: elementName('input-' + type), tag: 'input', type })),
	{ name: 'HtmlElement', tag: 'svelte:element' }
];

export function atomTag(atom) {
	const name = atom.name === 'SvgSvg' ? 'Svg' : atom.name.replace(/^Html/, '');
	return 'hx-' + name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function nativeAtomSource(atom) {
	const descriptor = [atom.tag, atom.type].filter(Boolean).join(' ');
	return `<!-- @harness-tier atom -->
<!-- @harness-element ${descriptor} -->
${svgElements.includes(atom.tag) ? '<svelte:options namespace="svg" />\n' : ''}<script lang="ts">
\timport type { Snippet } from 'svelte';
\tlet { children, ${atom.tag === 'svelte:element' ? "this: tag = 'div', " : ''}...attributes }: { children?: Snippet; ${atom.tag === 'svelte:element' ? 'this?: string; ' : ''}[attribute: string]: unknown } = $props();
</script>

<svelte:element this={${atom.tag === 'svelte:element' ? 'tag' : `'${atom.tag}'`}} {...attributes}${atom.type ? ` type="${atom.type}"` : ''}>
${voidElements.has(atom.tag) ? '' : '\t{#if children}{@render children()}{/if}'}
</svelte:element>
`;
}
