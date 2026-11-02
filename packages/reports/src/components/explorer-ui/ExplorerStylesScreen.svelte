<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { appStyleTokensConfig } from '../../configs/shared-primitives/appStyleTokensConfig';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import type {
		StyleRoleCard,
		StyleToken
	} from './ExplorerStylesScreen.types';
	import { assignRoles, drawings, groupTokens, headingId, roles, sample } from './styleTokenGroups';
	import { discoverTokens } from './styleTokenReading';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import HarnessGroup from './HarnessGroup.svelte';
	import '../../lib/styles/explorer-styles.css';
	let host: ExplorerScreenProps = $props();
	let tokens = $state<StyleToken[]>([]);
	let groups = $derived(groupTokens(tokens));
	onMount(() => {
		tokens = discoverTokens();
	});
</script>

<!-- The specimen reads the token itself, so it shows the value this browser resolves. -->
{#snippet specimen(token: StyleToken)}
	{@const [, kind, rule] = drawings.find(([prefix]) => prefix.test(token.name))!}
	{@const style = rule.replace('$', `var(${token.name})`)}
	{#if kind === 'text'}
		<hx-p class="hx-style-specimen" {style}>
			<hx-span>{sample(token.name)}</hx-span>
		</hx-p>
	{:else if kind === 'value'}
		<hx-p class="hx-style-value">{token.value}</hx-p>
	{:else}
		<hx-div class="hx-style-frame" aria-hidden="true">
			<hx-span class={`hx-style-${kind}`} {style}></hx-span>
		</hx-div>
	{/if}
{/snippet}

<!-- A role: its purpose, its variable with resolved value and sample, then where it is used. -->
{#snippet card(group: string, role: StyleRoleCard)}
	{@const id = headingId(`${group} ${role.name}`)}
	<hx-article class="hx-style-role" aria-labelledby={id}>
		<hx-h3 {id}>{role.name}</hx-h3>
		{#if role.use}
			<hx-p><hx-strong>Use for</hx-strong> {role.use}</hx-p>
		{/if}
		{#each role.sets as { label, base, rows } (label)}
			<hx-div role="group" aria-labelledby={`${id}-${base}`} class:hx-style-base={base}>
				<hx-p id={`${id}-${base}`}>{label}</hx-p>
				{#each rows as token (token.name)}
					<hx-div data-style-token={token.name}>
						<hx-code>{token.name}</hx-code>
						<hx-span>{base ? token.resolved : token.value}</hx-span>
						{@render specimen(token)}
					</hx-div>
				{/each}
			</hx-div>
			{#if base && role.where}
				<hx-p><hx-strong>Where used</hx-strong> {role.where}</hx-p>
			{/if}
		{/each}
	</hx-article>
{/snippet}
<ExplorerFrame {host}>
	{#snippet children(_nav)}
		<hx-section
			data-harness-component="explorer-ui-harness-explorer-styles-screen"
			class="hx-styles-page"
			aria-labelledby="styles-title"
		>
			<hx-header class="hx-styles-intro">
				<hx-p class="hx-styles-kicker">Design system</hx-p>
				<hx-h1 id="styles-title">Styles</hx-h1>
				<hx-p>What each shared choice is for, the value it resolves to and where it is used.</hx-p>
			</hx-header>
			<hx-div class="hx-styles-groups">
				{#each groups as group (group.name)}
					<HarnessGroup
						title={group.name}
						count={group.tokens.length}
						description={group.description}
						variant="styles"
						resetKey={host.scope.commit}
					>
						{#if group.name === appStyleTokensConfig.foundation}
							<hx-p class="hx-styles-kicker">Foundation</hx-p>
						{/if}
						<hx-div class="hx-styles-grid" class:hx-style-roles={!!roles[group.name]}>
							{#if roles[group.name]}
								{#each assignRoles(group) as role (role.name)}
									{@render card(group.name, role)}
								{/each}
							{:else}
								{#each group.tokens as token (token.name)}
									<hx-article class="hx-style-token" data-style-token={token.name}>
										<hx-header class="hx-style-token-head">
											<hx-code>{token.name}</hx-code>
											<hx-span>{token.value}</hx-span>
										</hx-header>
										{@render specimen(token)}
									</hx-article>
								{/each}
							{/if}
						</hx-div>
					</HarnessGroup>
				{/each}
			</hx-div>
		</hx-section>
	{/snippet}
</ExplorerFrame>
