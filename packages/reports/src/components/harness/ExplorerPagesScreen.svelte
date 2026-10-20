<script lang="ts">
	import { entityCatalog } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { catalogShot } from '../../utils/entityScreens';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './explorer-index/ExplorerIndex.svelte';
	import ExplorerPageCard from './ExplorerPageCard.svelte';
	let host: ExplorerScreenProps = $props();
	let rows = $derived(entityCatalog(host.entities, 'pages', host.lens.relations));
</script>

<!-- The pages of the app as cards: where a person starts, each with its own screenshot. -->
<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex category="pages" {rows}>
			{#snippet list(listed)}
				<div class="ex-page-grid">
					{#each listed as row (row.id)}
						<ExplorerPageCard
							{row}
							shot={catalogShot(host.lens.evidence(row.entity.unit), row.entity.unit.preview)}
							mediaBase={host.mediaBase}
							{nav}
						/>
					{/each}
				</div>
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>
