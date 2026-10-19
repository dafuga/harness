<script lang="ts">
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { screenOptions } from '../../utils/entityScreens';
	import { entityChanged } from '../../utils/entityShown';
	import EntityAudio from './EntityAudio.svelte';
	import EntityFrame from './EntityFrame.svelte';
	import EntityScreens from './EntityScreens.svelte';
	import EntitySections from './entity-sections/EntitySections.svelte';
	let host: ExplorerScreenProps = $props();
</script>

<!-- What is seen: a page or a shell opens on its screenshots, which a component keeps above its
	tabs instead; a clip of it is heard below. -->
<EntityFrame {host}>
	{#snippet children(entity, nav)}
		<EntitySections {host} {entity} {nav}>
			{#snippet pane()}
				{@const evidence = host.lens.evidence(entity.unit)}
				{#if entity.category !== 'components'}
					<EntityScreens
						options={screenOptions(evidence.scenarios)}
						{evidence}
						scope={host.scope}
						mediaBase={host.mediaBase}
						{nav}
						reasons={entityChanged(host, entity.id)}
					/>
				{/if}
				<EntityAudio {evidence} scope={host.scope} mediaBase={host.mediaBase} />
			{/snippet}
		</EntitySections>
	{/snippet}
</EntityFrame>
