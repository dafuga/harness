<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityShown } from './entity-sections/entityShown';
	import EntityDetails from './EntityDetails.svelte';
	import EntityFrame from './EntityFrame.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- The details of an entity of any kind: contract, measurements, and the source on request. -->
<EntityFrame {host}>
	{#snippet children(entity)}
		{@const summary = entityShown(host, entity)}
		<EntityDetails
			{entity}
			contract={summary.contract}
			measure={summary.measure}
			record={summary.record}
			tab={host.route.tab}
			mediaBase={host.mediaBase}
			commit={entity.lastAt ?? host.scope.commit}
		/>
	{/snippet}
</EntityFrame>
