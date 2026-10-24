<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
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
	import HarnessTabs from '../HarnessTabs.svelte';
	let input: HarnessNavbarInput = $props();
	let view = $derived(harnessShell(input));
	let revision = $derived(view.revision);
	let search = $derived(navbarSearch(input.scope, input.search?.entries));
	const moduleActive = $derived(
		view.categories.some((item) => item.id === 'modules' && item.active)
	);
	const kinds = $derived(view.modules.map((item) => ({ ...item, href: item.href ?? undefined })));
	const found = (entry: SearchEntry) => search.at(entry);
	// A plain click stays in the application; any other is the link it is.
	function follow(event: MouseEvent, to: ExplorerLocation | null) {
		if (!to || !plainClick(event)) return;
		event.preventDefault();
		input.onroute(to);
	}
	function openKind(id: string) {
		const to = view.modules.find((item) => item.id === id)?.to;
		if (to) input.onroute(to);
	}
</script>

<hx-header class="hx-nav" data-harness-component="harness-harness-navbar">
	<hx-a class="hx-brand" href={view.home.href} onclick={(event) => follow(event, view.home.to)}>
		<hx-span class="hx-mark"><BrandMark size={30} /></hx-span>
		<hx-span>Harness</hx-span>
	</hx-a>
	{#if input.repository}<hx-span class="hx-repository">{input.repository}</hx-span>{/if}
	<hx-nav class="hx-categories" aria-label="Harness categories">
		{#each view.categories as item (item.id)}
			{#if item.href}
				<hx-a
					href={item.href}
					aria-current={item.active ? 'page' : undefined}
					onclick={(event) => follow(event, item.to)}
					><HarnessIcon name={item.icon} size={24} /><hx-span>{item.label}</hx-span></hx-a
				>
			{:else}
				<hx-span class="hx-category" aria-disabled="true"
					><HarnessIcon name={item.icon} size={24} /><hx-span>{item.label}</hx-span></hx-span
				>
			{/if}
		{/each}
	</hx-nav>
	{#if input.scope && moduleActive}
		<HarnessTabs
			view={input.scope.location.category}
			onview={openKind}
			tabs={kinds}
			label="Module categories"
		/>
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
		<hx-div class="hx-search">
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
		</hx-div>
	{/if}
</hx-header>
