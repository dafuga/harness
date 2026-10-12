<script lang="ts">
	import { entityCatalog } from '../../utils/entityCatalog';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import ExplorerFrame from './ExplorerFrame.svelte';
	import ExplorerIndex from './ExplorerIndex.svelte';
	import ExplorerTable from './ExplorerTable.svelte';
	let host: ExplorerScreenProps = $props();
	let category = $derived(host.route.category);
	let rows = $derived(entityCatalog(host.entities, category, host.lens.relations));
</script>

<!-- Components, functions, configs or services as a table with the columns of their kind. -->
<ExplorerFrame {host}>
	{#snippet children(nav)}
		<ExplorerIndex {category} {rows}>
			{#snippet list(listed)}
				<!-- Pages are cards on a screen of their own; this one draws the four other kinds. -->
				{#if category !== 'pages'}
					<ExplorerTable {category} rows={listed} {nav} />
				{/if}
			{/snippet}
		</ExplorerIndex>
	{/snippet}
</ExplorerFrame>
