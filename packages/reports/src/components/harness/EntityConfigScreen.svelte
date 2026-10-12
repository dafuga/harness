<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import EntityConfig from './EntityConfig.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntitySections from './EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- What is set: a config opens on what it provides and who uses it; it is not seen or run. -->
<EntityFrame {host}>
	{#snippet children(entity, nav)}
		<EntitySections {host} {entity} {nav}>
			{#snippet pane()}
				<EntityConfig
					{entity}
					relations={host.lens.relations(entity.id)}
					scope={host.scope}
					{nav}
				/>
			{/snippet}
		</EntitySections>
	{/snippet}
</EntityFrame>
