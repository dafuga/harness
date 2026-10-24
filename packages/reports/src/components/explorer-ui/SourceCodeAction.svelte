<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import HarnessAction from './HarnessAction.svelte';
	let {
		entity,
		nav,
		title,
		path
	}: {
		entity: ExplorerEntity;
		nav: EntityNav;
		/** The name the entity is shown under here; its own name otherwise. */
		title?: string;
		path: string;
	} = $props();
	let named = $derived(title ?? entity.name);
</script>

<!-- Rendered alone, without a host for the reader, it has nothing to open. -->
<HarnessAction
	tone="plain"
	lead="file"
	label={`View code for ${path}`}
	disabled={!nav.source}
	onclick={(event) => nav.source?.(entity, named, event.currentTarget as HTMLElement, path)}
	>View code</HarnessAction
>
