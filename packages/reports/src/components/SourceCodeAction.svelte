<script lang="ts">
	import type { ExplorerEntity } from '../models/Explorer.types';
	import type { EntityNav } from '../utils/entityLens';
	import HarnessAction from './harness/HarnessAction.svelte';
	let {
		entity,
		nav,
		title
	}: {
		entity: ExplorerEntity;
		nav: EntityNav;
		/** The name the entity is shown under here; its own name otherwise. */
		title?: string;
	} = $props();
	let named = $derived(title ?? entity.name);
</script>

<!-- Rendered alone, without a host for the reader, it has nothing to open. -->
<HarnessAction
	tone="plain"
	lead="file"
	label={`View code for ${named}`}
	disabled={!nav.source}
	onclick={(event) => nav.source?.(entity, named, event.currentTarget as HTMLElement)}
	>View code</HarnessAction
>
