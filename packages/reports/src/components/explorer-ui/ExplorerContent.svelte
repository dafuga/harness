<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Screen } from './ExplorerContent.types';

	import type { Component } from 'svelte';
	import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import EntityBehaviorScreen from './EntityBehaviorScreen.svelte';
	import EntityConfigScreen from './EntityConfigScreen.svelte';
	import EntityDetailsScreen from './EntityDetailsScreen.svelte';
	import EntityHistoryScreen from './EntityHistoryScreen.svelte';
	import EntityVisualScreen from './EntityVisualScreen.svelte';
	import ExplorerCatalogScreen from './ExplorerCatalogScreen.svelte';
	import ExplorerPagesScreen from './ExplorerPagesScreen.svelte';
	import ExplorerPlatforms from './ExplorerPlatforms.svelte';
	import ExplorerTranslationsScreen from './ExplorerTranslationsScreen.svelte';
	import ExplorerStylesScreen from './ExplorerStylesScreen.svelte';
	import ExplorerDependenciesScreen from './ExplorerDependenciesScreen.svelte';
	let host: ExplorerScreenProps = $props();
	const overviews: Record<ExplorerCategory, Screen> = {
		pages: EntityVisualScreen,
		apis: EntityBehaviorScreen,
		layouts: EntityVisualScreen,
		components: EntityVisualScreen,
		functions: EntityBehaviorScreen,
		services: EntityBehaviorScreen,
		configs: EntityConfigScreen,
		models: EntityConfigScreen,
		types: EntityConfigScreen,
		platforms: ExplorerPlatforms
	};
	// An entity opens as the kind it is at this revision, whatever its address calls it.
	let kind = $derived(
		host.entities.find((item) => item.id === host.route.entity)?.category ?? host.route.category
	);
	/** The one screen an address is; this content holds none of its own. */
	let Shown = $derived.by((): Screen => {
		const { category, entity, section } = host.route;
		if (host.route.screen === 'styles') return ExplorerStylesScreen;
		if (host.route.screen === 'translations') return ExplorerTranslationsScreen;
		if (host.route.screen === 'dependencies') return ExplorerDependenciesScreen;
		if (category === 'platforms') return ExplorerPlatforms;
		if (!entity && !host.route.helper)
			return category === 'pages' ? ExplorerPagesScreen : ExplorerCatalogScreen;
		if (section === 'details') return EntityDetailsScreen;
		return section === 'history' ? EntityHistoryScreen : overviews[kind];
	});
</script>

<!-- Any address of the explorer, for a host without a page of its own for each screen. Its marker
	draws no box. -->
<hx-div class="ex-shown" data-harness-component="harness-explorer-content">
	<Shown {...host} />
</hx-div>

<style>
	.ex-shown {
		display: contents;
	}
</style>
