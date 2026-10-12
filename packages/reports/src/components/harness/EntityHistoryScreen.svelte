<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import EntityFrame from './EntityFrame.svelte';
	import EntityHistory from './EntityHistory.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- The history of an entity of any kind, through the shown commit. -->
<EntityFrame {host}>
	{#snippet children(entity, nav)}
		<!-- A history belongs to one entity at one commit; another one starts from nothing read. -->
		{#key entity.id + host.scope.commit}
			<EntityHistory
				{entity}
				rows={host.lens.history(entity.id)}
				index={host.index}
				scope={host.scope}
				known={host.parent ? [host.head, host.parent] : [host.head]}
				client={host.client}
				{nav}
			/>
		{/key}
	{/snippet}
</EntityFrame>
