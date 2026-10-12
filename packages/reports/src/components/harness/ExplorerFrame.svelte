<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ExplorerScreenProps } from '../../models/ExplorerScreen.types';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import '../../lib/styles/entity.css';
	import '../../lib/styles/entity-summary.css';
	import '../../lib/styles/entity-index.css';
	import '../../lib/styles/entity-evidence.css';
	import '../../lib/styles/entity-history.css';
	import EntityMissing from './EntityMissing.svelte';
	let {
		host,
		children
	}: {
		/** What the host of the explorer gives the screen. */
		host: ExplorerScreenProps;
		/** The screen itself, drawn only where the revision has a registry to read it from. */
		children: Snippet<[EntityNav]>;
	} = $props();
	let nav = $derived<EntityNav>({ route: host.route, href: host.lens.href, go: host.onroute });
	let registry = $derived(host.head.registry);
	let gap = $derived(
		registry.gap ?? `No unit registry is stored at ${shortCommit(host.scope.commit)}`
	);
</script>

<div class="ex-content" data-mode={host.scope.mode}>
	{#if !registry.available}
		<EntityMissing
			title="No registry at this revision"
			message={`${gap}.`}
			{nav}
			to={entityLens(host.route, { category: host.route.category })}
			action="Stay on this revision"
		/>
	{:else}
		{@render children(nav)}
	{/if}
</div>
