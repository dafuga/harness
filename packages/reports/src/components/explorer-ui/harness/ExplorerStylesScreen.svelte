<script lang="ts">
	import { onMount } from 'svelte';
	import type { ExplorerScreenProps } from '../../../models/explorer-ui/ExplorerScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import '../../../lib/styles/explorer-styles.css';
	let host: ExplorerScreenProps = $props();

	type GroupName = 'Colors' | 'Font families' | 'Type scale' | 'Text styles' | 'Layout tokens';
	interface StyleToken {
		name: string;
		value: string;
		group: GroupName;
	}
	const groupNames: GroupName[] = [
		'Colors',
		'Font families',
		'Type scale',
		'Text styles',
		'Layout tokens'
	];
	let tokens = $state<StyleToken[]>([]);
	let groups = $derived(
		groupNames.map((name) => ({ name, tokens: tokens.filter((token) => token.group === name) }))
	);

	function groupFor(name: string): GroupName {
		if (name.startsWith('--hx-font-family-')) return 'Font families';
		if (name.startsWith('--hx-type-size-')) return 'Type scale';
		if (name.startsWith('--hx-style-')) return 'Text styles';
		if (/^--hx-(radius|gutter|nav-gap)/.test(name)) return 'Layout tokens';
		return 'Colors';
	}

	function collectRules(rules: CSSRuleList, names: Set<string>) {
		for (const rule of Array.from(rules)) {
			if ('style' in rule) {
				const style = (rule as CSSStyleRule).style;
				for (let index = 0; index < style.length; index += 1) {
					const name = style.item(index);
					if (name.startsWith('--hx-')) names.add(name);
				}
			}
			if ('cssRules' in rule) {
				try {
					collectRules((rule as CSSGroupingRule).cssRules, names);
				} catch {
					// A cross-origin stylesheet cannot expose its rules to this page.
				}
			}
		}
	}

	function discoverTokens(): StyleToken[] {
		const names = new Set<string>();
		for (const sheet of Array.from(document.styleSheets)) {
			try {
				collectRules(sheet.cssRules, names);
			} catch {
				// Only same-origin app stylesheets can be inspected.
			}
		}
		const shell = document.querySelector<HTMLElement>('.hx-shell');
		const nav = document.querySelector<HTMLElement>('.hx-nav');
		return [...names]
			.sort((left, right) => left.localeCompare(right))
			.flatMap((name) => {
				const element = name === '--hx-nav-gap' ? nav : shell;
				const value = element ? getComputedStyle(element).getPropertyValue(name).trim() : '';
				return value ? [{ name, value, group: groupFor(name) }] : [];
			});
	}

	function specimenStyle(token: StyleToken): string {
		if (token.group === 'Font families') return `font-family: ${token.value};`;
		if (token.group === 'Type scale') return `font-size: ${token.value};`;
		const property = token.name.startsWith('--hx-style-weight-')
			? 'font-weight'
			: token.name.startsWith('--hx-style-font-')
				? 'font-style'
				: 'line-height';
		return `${property}: ${token.value};`;
	}

	function layoutStyle(token: StyleToken): string {
		if (token.name.startsWith('--hx-radius')) return `border-radius: ${token.value};`;
		if (token.name === '--hx-gutter') return `padding: ${token.value};`;
		return `gap: ${token.value};`;
	}

	onMount(() => {
		tokens = discoverTokens();
	});
</script>

<ExplorerFrame {host}>
	{#snippet children(_nav)}
		<section class="hx-styles-page" aria-labelledby="styles-title">
			<header class="hx-styles-intro">
				<p class="hx-styles-kicker">Design system</p>
				<h1 id="styles-title">Styles</h1>
				<p>Colors, typography and layout values used across Harness.</p>
			</header>

			<div class="hx-styles-groups">
				{#each groups as group (group.name)}
					<section class="hx-styles-group" aria-labelledby={`group-${group.name}`}>
						<div class="hx-styles-group-heading">
							<h2 id={`group-${group.name}`}>{group.name}</h2>
							<span>{group.tokens.length}</span>
						</div>
						<div class="hx-styles-grid">
							{#each group.tokens as token (token.name)}
								<article class="hx-style-token" data-style-token={token.name}>
									<header class="hx-style-token-head">
										<code>{token.name}</code>
										<span>{token.value}</span>
									</header>
									{#if group.name === 'Colors'}
										<div
											class="hx-style-color"
											style={`--hx-token-swatch: ${token.value}`}
											aria-hidden="true"
										>
											<span></span><span></span>
										</div>
									{:else if group.name === 'Layout tokens'}
										<div
											class="hx-style-layout-preview"
											style={layoutStyle(token)}
											aria-hidden="true"
										>
											<span></span><span></span><span></span>
										</div>
									{:else}
										<p class="hx-style-specimen" style={specimenStyle(token)}>
											<span>
												{#if token.name.startsWith('--hx-style-leading-')}
													Line one<br />Line two
												{:else if group.name === 'Font families'}
													Harness design system
												{:else}
													Aa Bb 0123
												{/if}
											</span>
										</p>
									{/if}
								</article>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</section>
	{/snippet}
</ExplorerFrame>
