<script lang="ts">
	import { onMount } from 'svelte';
	import { appStyleTokensConfig } from '../../config/shared-primitives/appStyleTokensConfig';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		StyleGroupName,
		StyleSpecimen,
		StyleToken,
		StyleTokenGroup,
		UnclassifiedGroupName
	} from './ExplorerStylesScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import '../../lib/styles/explorer-styles.css';
	let host: ExplorerScreenProps = $props();

	const unclassified: UnclassifiedGroupName = 'Unclassified tokens';
	/** The token prefixes each declared group owns; a name none of them claims stays unclassified. */
	const prefixes: Record<StyleGroupName, RegExp> = {
		Colors:
			/^--hx-(?:bg|surface|raised|line|text|soft|muted|gold|pass|fail|accent|danger|warning|tint|scrim)(?:-|$)/,
		'Font families': /^--hx-font-family-/,
		'Type scale': /^--hx-type-size-/,
		'Text styles': /^--hx-style-/,
		Spacing: /^--hx-space-/,
		'Borders and corners': /^--hx-(?:border|radius)(?:-|$)/,
		Shadows: /^--hx-shadow-/,
		Opacity: /^--hx-opacity-/,
		Motion: /^--hx-motion-/,
		Layering: /^--hx-layer-/,
		'Layout tokens': /^--hx-(?:gutter$|nav-|layout-)/,
		'Responsive breakpoints': /^--hx-breakpoint-/
	};
	const descriptions: Record<StyleGroupName, string> = {
		Colors: 'The thirteen palette colors, and treatments mixed only from them.',
		'Font families': 'Inter for interface text, and a named monospace stack for code.',
		'Type scale': 'Fixed font sizes, fluid title sizes, and inline text sized to its parent.',
		'Text styles': 'Weights, styles, leading, tracking, numerals and whole font shorthands.',
		Spacing: 'Padding, margin and gap lengths, each named by its size in pixels.',
		'Borders and corners': 'Border widths and corner radii.',
		Shadows: 'Elevation and outline rings, painted with the shared shadow tint.',
		Opacity: 'Translucency of faint, disabled and secondary content.',
		Motion: 'Transition and animation durations.',
		Layering: 'Stacking order, from behind content to a full-screen view.',
		'Layout tokens': 'Gutters, navigation gaps and structural clearances.',
		'Responsive breakpoints': 'Reference widths, repeated literally by media queries.'
	};
	/** How a group draws its tokens; `$` stands for the token's own reference. */
	const groupDrawings: Record<StyleGroupName, [StyleSpecimen, string]> = {
		Colors: ['swatch', '--style-specimen: $'],
		'Font families': ['text', 'font-family: $'],
		'Type scale': ['text', 'font-size: $'],
		'Text styles': ['text', 'font: $'],
		Spacing: ['bar', 'inline-size: $'],
		'Borders and corners': ['corner', 'border-radius: $'],
		Shadows: ['shadow', 'box-shadow: $'],
		Opacity: ['fade', 'opacity: $'],
		Motion: ['value', ''],
		Layering: ['value', ''],
		'Layout tokens': ['bar', 'inline-size: $'],
		'Responsive breakpoints': ['bar', 'inline-size: calc($ / 6)']
	};
	/** Tokens of a group that one property of their own draws. */
	const prefixDrawings: [RegExp, StyleSpecimen, string][] = [
		[/^--hx-style-weight-/, 'text', 'font-weight: $'],
		[/^--hx-style-font-/, 'text', 'font-style: $'],
		[/^--hx-style-leading-/, 'text', 'line-height: $'],
		[/^--hx-style-tracking-/, 'text', 'letter-spacing: $'],
		[/^--hx-style-numeric-/, 'text', 'font-variant-numeric: $'],
		[/^--hx-style-synthesis-/, 'text', 'font-synthesis: $'],
		[/^--hx-border-/, 'edge', 'border-block-start: $ solid']
	];
	let tokens = $state<StyleToken[]>([]);
	let groups = $derived(groupTokens(tokens));

	function groupFor(name: string): StyleGroupName | UnclassifiedGroupName {
		return appStyleTokensConfig.groups.find((group) => prefixes[group].test(name)) ?? unclassified;
	}

	function groupTokens(list: StyleToken[]): StyleTokenGroup[] {
		const declared = appStyleTokensConfig.groups.map((name) => ({
			name,
			description: descriptions[name],
			tokens: list.filter((token) => token.group === name)
		}));
		const rest = list.filter((token) => token.group === unclassified);
		if (!rest.length) return declared;
		const description = 'Shared tokens whose prefix no group above claims.';
		return [...declared, { name: unclassified, description, tokens: rest }];
	}

	/** Only :root rules publish app tokens; a component stylesheet's own variables are not listed. */
	function readRules(rules: CSSRuleList, found: Map<string, string>) {
		for (const rule of Array.from(rules)) {
			if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
				readStyle(rule.style, found);
			} else if (rule instanceof CSSImportRule && rule.styleSheet) {
				readSheet(rule.styleSheet, found);
			} else if ('cssRules' in rule) {
				readRules((rule as CSSGroupingRule).cssRules, found);
			}
		}
	}

	function readSheet(sheet: CSSStyleSheet, found: Map<string, string>) {
		try {
			readRules(sheet.cssRules, found);
		} catch {
			// A cross-origin stylesheet cannot expose its rules to this page.
		}
	}

	function readStyle(style: CSSStyleDeclaration, found: Map<string, string>) {
		for (let index = 0; index < style.length; index += 1) {
			const name = style.item(index);
			if (name.startsWith('--hx-') && !found.has(name))
				found.set(name, style.getPropertyValue(name).replace(/\s+/g, ' ').trim());
		}
	}

	/** The tokens in the order the token source declares them. */
	function discoverTokens(): StyleToken[] {
		const found = new Map<string, string>();
		for (const sheet of Array.from(document.styleSheets)) readSheet(sheet, found);
		return [...found].map(([name, value]) => ({ name, value, group: groupFor(name) }));
	}

	function drawing(token: StyleToken): [StyleSpecimen, string] {
		const own = prefixDrawings.find(([prefix]) => prefix.test(token.name));
		if (own) return [own[1], own[2]];
		return token.group === unclassified ? ['value', ''] : groupDrawings[token.group];
	}

	/** The specimen reads the token itself, so it shows the value this browser resolves. */
	function specimenStyle(token: StyleToken): string {
		return drawing(token)[1].replace('$', `var(${token.name})`);
	}

	function sample(token: StyleToken): string {
		if (token.group === 'Font families') return 'Harness design system';
		if (token.name.startsWith('--hx-style-leading-')) return 'Line one\nLine two';
		return token.name.startsWith('--hx-style-numeric-') ? '1111 8888 0123' : 'Aa Bb 0123';
	}

	const headingId = (name: string) => `styles-group-${name.toLowerCase().replace(/\W+/g, '-')}`;

	onMount(() => {
		tokens = discoverTokens();
	});
</script>

{#snippet specimen(token: StyleToken)}
	{@const kind = drawing(token)[0]}
	{#if kind === 'swatch'}
		<div class="hx-style-color" style={specimenStyle(token)} aria-hidden="true">
			<span></span><span></span>
		</div>
	{:else if kind === 'text'}
		<p class="hx-style-specimen" style={specimenStyle(token)}>
			<span>{sample(token)}</span>
		</p>
	{:else if kind === 'value'}
		<p class="hx-style-value">{token.value}</p>
	{:else}
		<div class="hx-style-frame" aria-hidden="true">
			<span class={`hx-style-${kind}`} style={specimenStyle(token)}></span>
		</div>
	{/if}
{/snippet}

<ExplorerFrame {host}>
	{#snippet children(_nav)}
		<section
			data-harness-component="explorer-ui-harness-explorer-styles-screen"
			class="hx-styles-page"
			aria-labelledby="styles-title"
		>
			<header class="hx-styles-intro">
				<p class="hx-styles-kicker">Design system</p>
				<h1 id="styles-title">Styles</h1>
				<p>
					The shared design tokens of Reports, Desktop and Hub, each drawn with the value this
					browser resolves.
				</p>
			</header>

			<div class="hx-styles-groups">
				{#each groups as group (group.name)}
					<section class="hx-styles-group" aria-labelledby={headingId(group.name)}>
						<div class="hx-styles-group-heading">
							<h2 id={headingId(group.name)}>{group.name}</h2>
							<span>{group.tokens.length}</span>
							<p>{group.description}</p>
						</div>
						<div class="hx-styles-grid">
							{#each group.tokens as token (token.name)}
								<article class="hx-style-token" data-style-token={token.name}>
									<header class="hx-style-token-head">
										<code>{token.name}</code>
										<span>{token.value}</span>
									</header>
									{@render specimen(token)}
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</section>
	{/snippet}
</ExplorerFrame>
