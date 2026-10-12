<script lang="ts">
	import type { Evidence } from '../../models/Report.types';
	import { entityCatalog, type CatalogRow } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityScreens, screenOptions, screenPick } from '../../utils/entityScreens';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './ExplorerIndex.svelte';
	import ExplorerPageCard from './ExplorerPageCard.svelte';
	let host: ExplorerScreenProps = $props();
	let rows = $derived(entityCatalog(host.entities, 'pages', host.lens.relations));
	/** The screenshot a page card shows: the page's own first state at the shown revision. */
	function shot(row: CatalogRow): Evidence | null {
		const found = host.lens.evidence(row.entity.unit);
		const pick = screenPick(screenOptions(found.scenarios), {});
		return pick ? entityScreens(found, pick).after : null;
	}
</script>

<!-- The pages of the app as cards: where a person starts, each with its own screenshot. -->
<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex category="pages" {rows}>
			{#snippet list(listed)}
				<div class="ex-page-grid">
					{#each listed as row (row.id)}
						<ExplorerPageCard {row} shot={shot(row)} mediaBase={host.mediaBase} {nav} />
					{/each}
				</div>
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>
