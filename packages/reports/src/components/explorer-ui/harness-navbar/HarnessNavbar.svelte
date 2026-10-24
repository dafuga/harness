<script lang="ts">
	import BrandMark from '../../shared-primitives/BrandMark.svelte';
	import type { ExplorerLocation } from '../../../models/explorer-ui/Explorer.types';
	import type { SearchEntry } from '../../../utils/explorer-ui/entitySearch';
	import { harnessShell } from './harnessShell';
	import { plainClick, type HarnessNavbarInput } from '../../../utils/explorer-ui/harnessShell';
	import { navbarSearch } from './navbarSearch';
	import EntitySearch from '../entity-search/EntitySearch.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessSelectors from '../harness-selectors/HarnessSelectors.svelte';
	let input: HarnessNavbarInput = $props();
	const id = $props.id();
	let view = $derived(harnessShell(input));
	let revision = $derived(view.revision);
	let search = $derived(navbarSearch(input.scope, input.search?.entries));
	// The bubble Modules opens, whether it is open, and the address that closes it on changing.
	let bubble = $state<HTMLElement>();
	let expanded = $state(false);
	let address = $derived(input.scope ? input.href(input.scope.location) : null);
	const found = (entry: SearchEntry) => search.at(entry);
	// A plain click stays in the application; any other is the link it is.
	function follow(event: MouseEvent, to: ExplorerLocation | null) {
		if (!to || !plainClick(event)) return;
		event.preventDefault();
		input.onroute(to);
	}
	function close() {
		if (bubble?.matches(':popover-open')) bubble.hidePopover();
	}
	// A module category chosen with a plain click closes the bubble; a modified one leaves it open.
	function choose(event: MouseEvent, to: ExplorerLocation | null) {
		if (plainClick(event)) close();
		follow(event, to);
	}
	// Another address closes the bubble, also one that takes the bubble away with no toggle.
	$effect(() => {
		void address;
		close();
		expanded = false;
	});
</script>

<header class="hx-nav" data-harness-component="harness-harness-navbar">
	<a class="hx-brand" href={view.home.href} onclick={(event) => follow(event, view.home.to)}>
		<span class="hx-mark"><BrandMark size={30} /></span>
		<span>Harness</span>
	</a>
	{#if input.repository}<span class="hx-repository">{input.repository}</span>{/if}
	<nav class="hx-categories" aria-label="Harness categories">
		{#each view.categories as item (item.id)}
			{#if item.id === 'modules' && view.modules.length > 0}
				<button
					type="button"
					popovertarget={id}
					aria-expanded={expanded}
					aria-current={item.active ? 'page' : undefined}
					><HarnessIcon name={item.icon} size={24} /><span>{item.label}</span></button
				>
			{:else if item.href}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					onclick={(event) => follow(event, item.to)}
					><HarnessIcon name={item.icon} size={24} /><span>{item.label}</span></a
				>
			{:else}
				<span class="hx-category" aria-disabled="true"
					><HarnessIcon name={item.icon} size={24} /><span>{item.label}</span></span
				>
			{/if}
		{/each}
	</nav>
	<!-- The six module categories float under Modules, over the page; the bar keeps its height. -->
	{#if view.modules.length > 0}
		<nav
			{id}
			class="hx-modules"
			aria-label="Module categories"
			popover="auto"
			bind:this={bubble}
			ontoggle={(event) => (expanded = event.newState === 'open')}
		>
			{#each view.modules as item (item.id)}
				<a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					onclick={(event) => choose(event, item.to)}>{item.label}</a
				>
			{/each}
		</nav>
	{/if}
	{#if revision && input.index}
		<HarnessSelectors
			index={input.index}
			branch={revision.branch}
			commit={revision.commit}
			commits={revision.commits}
			bases={null}
			from=""
			onbranch={(name) => input.onroute(revision.branchTo(name))}
			oncommit={(commit) => input.onroute(revision.commitTo(commit))}
			onbase={() => {}}
			tip={{
				note: revision.note,
				viewed: revision.viewed,
				href: revision.tip?.href ?? null,
				onfollow: () => revision.tip && input.onroute(revision.tip.to)
			}}
		/>
	{/if}
	<!-- A bar without an address offers nothing to choose, so it has nothing to search either. -->
	{#if input.scope}
		<div class="hx-search">
			<EntitySearch
				entries={search.entries}
				scope={search.scope}
				href={(entry) => {
					const to = found(entry);
					return to ? input.href(to) : input.base;
				}}
				open={(entry) => {
					const to = found(entry);
					if (to) input.onroute(to);
				}}
			/>
		</div>
	{/if}
</header>
