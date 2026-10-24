<script lang="ts">
	import { onMount } from 'svelte';
	import { appStyleTokensConfig } from '../../configs/shared-primitives/appStyleTokensConfig';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		StyleGroupName,
		StyleRole,
		StyleRoleCard,
		StyleSpecimen,
		StyleToken,
		StyleTokenGroup,
		UnclassifiedGroupName
	} from './ExplorerStylesScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import HarnessGroup from './HarnessGroup.svelte';
	import '../../lib/styles/explorer-styles.css';
	let host: ExplorerScreenProps = $props();

	const unclassified: UnclassifiedGroupName = 'Unclassified tokens';
	const { groupPrefixes: prefixes, groupDescriptions: descriptions } = appStyleTokensConfig;
	const roles: Partial<Record<string, readonly StyleRole[]>> = appStyleTokensConfig.roles;
	/** How a token is drawn, by the first prefix it matches; `$` stands for its own reference. */
	const drawings: [RegExp, StyleSpecimen, string][] = [
		[/^--hx-(?:color-|(?:bg|gold|muted)$)/, 'swatch', '--style-specimen: $'],
		[/^--hx-font-family-/, 'text', 'font-family: $'],
		[/^--hx-type-size-/, 'text', 'font-size: $'],
		[/^--hx-style-weight-/, 'text', 'font-weight: $'],
		[/^--hx-style-font-/, 'text', 'font-style: $'],
		[/^--hx-style-leading-/, 'text', 'line-height: $'],
		[/^--hx-style-tracking-/, 'text', 'letter-spacing: $'],
		[/^--hx-style-numeric-/, 'text', 'font-variant-numeric: $'],
		[/^--hx-style-synthesis-/, 'text', 'font-synthesis: $'],
		[/^--hx-style-/, 'text', 'font: $'],
		[/^--hx-(?:space-|gutter$|nav-|layout-)/, 'bar', 'inline-size: $'],
		[/^--hx-border-/, 'edge', 'border-block-start: $ solid'],
		[/^--hx-radius/, 'corner', 'border-radius: $'],
		[/^--hx-shadow-/, 'shadow', 'box-shadow: $'],
		[/^--hx-effect-/, 'fade', 'filter: $'],
		[/^--hx-opacity-/, 'fade', 'opacity: $'],
		[/^--hx-breakpoint-/, 'bar', 'inline-size: calc($ / 6)'],
		[/^--hx-/, 'value', '']
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

	/** Each token once, under the first role that names it; a token no role names is still shown. */
	function assignRoles(group: StyleTokenGroup): StyleRoleCard[] {
		const left = new Set(group.tokens);
		const claim = (name: string) => [...left].filter((t) => t.name === name && left.delete(t));
		const sets = (base: StyleToken[], rows: StyleToken[]) =>
			[
				{ label: group.name === 'Colors' ? 'Base color' : 'Variable', base: true, rows: base },
				{ label: base.length ? 'Treatments' : 'Variables', base: false, rows }
			].filter((set) => set.rows.length);
		const cards = (roles[group.name] ?? []).map(({ base, tokens: treatments = [], ...role }) => ({
			...role,
			sets: sets(base ? claim(base) : [], treatments.flatMap(claim))
		}));
		const rest = sets([], [...left.values()]);
		return rest.length ? [...cards, { ...appStyleTokensConfig.unassigned, sets: rest }] : cards;
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

	/** The tokens in the order the token source declares them, with what each one resolves to. */
	function discoverTokens(): StyleToken[] {
		const found = new Map<string, string>();
		for (const sheet of Array.from(document.styleSheets)) readSheet(sheet, found);
		const root = getComputedStyle(document.documentElement);
		return [...found].map(([name, value]) => {
			const resolved = root.getPropertyValue(name).replace(/\s+/g, ' ').trim() || value;
			return { name, value, resolved, group: groupFor(name) };
		});
	}

	/** Two lines of numerals show leading and numeral styles; any other text style draws letters. */
	const sample = (name: string) =>
		/^--hx-style-(?:leading|numeric)-/.test(name) ? '1111 8888\n0123 4567' : 'Aa Bb 0123';

	const headingId = (name: string) => `styles-group-${name.toLowerCase().replace(/\W+/g, '-')}`;

	onMount(() => {
		tokens = discoverTokens();
	});
</script>

<!-- The specimen reads the token itself, so it shows the value this browser resolves. -->
{#snippet specimen(token: StyleToken)}
	{@const [, kind, rule] = drawings.find(([prefix]) => prefix.test(token.name))!}
	{@const style = rule.replace('$', `var(${token.name})`)}
	{#if kind === 'text'}
		<p class="hx-style-specimen" {style}>
			<span>{sample(token.name)}</span>
		</p>
	{:else if kind === 'value'}
		<p class="hx-style-value">{token.value}</p>
	{:else}
		<div class="hx-style-frame" aria-hidden="true">
			<span class={`hx-style-${kind}`} {style}></span>
		</div>
	{/if}
{/snippet}

<!-- A role: its purpose, its variable with resolved value and sample, then where it is used. -->
{#snippet card(group: string, role: StyleRoleCard)}
	{@const id = headingId(`${group} ${role.name}`)}
	<article class="hx-style-role" aria-labelledby={id}>
		<h3 {id}>{role.name}</h3>
		{#if role.use}
			<p><strong>Use for</strong> {role.use}</p>
		{/if}
		{#each role.sets as { label, base, rows } (label)}
			<div role="group" aria-labelledby={`${id}-${base}`} class:hx-style-base={base}>
				<p id={`${id}-${base}`}>{label}</p>
				{#each rows as token (token.name)}
					<div data-style-token={token.name}>
						<code>{token.name}</code>
						<span>{base ? token.resolved : token.value}</span>
						{@render specimen(token)}
					</div>
				{/each}
			</div>
			{#if base && role.where}
				<p><strong>Where used</strong> {role.where}</p>
			{/if}
		{/each}
	</article>
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
				<p>What each shared choice is for, the value it resolves to and where it is used.</p>
			</header>

			<div class="hx-styles-groups">
				{#each groups as group (group.name)}
					<HarnessGroup
						title={group.name}
						count={group.tokens.length}
						description={group.description}
						variant="styles"
						resetKey={host.scope.commit}
					>
						{#if group.name === appStyleTokensConfig.foundation}
							<p class="hx-styles-kicker">Foundation and compatibility</p>
						{/if}
						<div class="hx-styles-grid" class:hx-style-roles={!!roles[group.name]}>
							{#if roles[group.name]}
								{#each assignRoles(group) as role (role.name)}
									{@render card(group.name, role)}
								{/each}
							{:else}
								{#each group.tokens as token (token.name)}
									<article class="hx-style-token" data-style-token={token.name}>
										<header class="hx-style-token-head">
											<code>{token.name}</code>
											<span>{token.value}</span>
										</header>
										{@render specimen(token)}
									</article>
								{/each}
							{/if}
						</div>
					</HarnessGroup>
				{/each}
			</div>
		</section>
	{/snippet}
</ExplorerFrame>
