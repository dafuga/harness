<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Evidence } from '../../models/reports-media/Report.types';
	import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import type { EntityLens, EntityNav } from '../../utils/explorer-ui/entityLens';
	import ExplorerModuleCard from './ExplorerModuleCard.svelte';
	let {
		row,
		shot,
		mediaBase,
		nav,
		lens,
		category = 'pages'
	}: {
		row: CatalogRow;
		/** The entity's own screenshot at the shown revision, or null for its gap; never another's. */
		shot: Evidence | null;
		mediaBase: string;
		nav: EntityNav;
		lens: EntityLens;
		/** A page or a component card: its name, its own screenshot and where it is used. */
		category?: 'pages' | 'components';
		/** Still accepted, never shown: every card keeps verification on the entity detail page. */
		verification?: boolean;
	} = $props();
</script>

<!-- A page or component: drawn by the one module card, with its own screenshot or its gap. -->
<ExplorerModuleCard {row} {shot} {mediaBase} {nav} {lens} {category} />
