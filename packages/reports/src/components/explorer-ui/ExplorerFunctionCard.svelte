<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { type CatalogRow } from '../../utils/explorer-ui/entityCatalog';
	import { type EntityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import ExplorerModuleCard from './ExplorerModuleCard.svelte';
	let props: { row: CatalogRow; nav: EntityNav; lens: EntityLens; mediaBase: string } = $props();
</script>

<!-- A helper, service or model: drawn by the one module card, without an image area. -->
<ExplorerModuleCard {...props} />
