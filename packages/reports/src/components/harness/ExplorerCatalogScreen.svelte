<script lang="ts">
	import { entityCatalog } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { catalogShot } from '../../utils/entityScreens';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './ExplorerIndex.svelte';
	import ExplorerPageCard from './ExplorerPageCard.svelte';
	import ExplorerTable from './ExplorerTable.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(entityCatalog(host.entities, category, host.lens.relations));
</script>

<!-- Components as screenshot cards; shells, functions, configs or services as a table of their kind. -->
<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex {category} {rows}>
			{#snippet list(listed)}
				<!-- Pages are cards on a screen of their own; this one draws the five other kinds. -->
				{#if category === 'components'}
					<div class="ex-page-grid">
						{#each listed as row (row.id)}
							<ExplorerPageCard
								{row}
								category="components"
								shot={catalogShot(host.lens.evidence(row.entity.unit))}
								mediaBase={host.mediaBase}
								{nav}
							/>
						{/each}
					</div>
				{:else if category !== 'pages'}
					<ExplorerTable {category} rows={listed} {nav} />
				{/if}
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>
