<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { CatalogFilter } from '../../utils/explorer-ui/entityCatalog';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		noun,
		filter = $bindable()
	}: {
		/** What is searched, in the plural and lower case: `pages`, `components`. */
		noun: string;
		filter: CatalogFilter;
	} = $props();
</script>

<hx-div
	class="ex-controls"
	role="search"
	aria-label={`Find ${noun}`}
	data-harness-component="harness-explorer-controls"
>
	<hx-label class="ex-search">
		<HarnessIcon name="search" size={18} />
		<hx-input
			type="search"
			placeholder={`Search ${noun}…`}
			aria-label={`Search ${noun}`}
			bind:value={filter.search}
		/>
	</hx-label>
</hx-div>

<style>
	:global(.ex-content .ex-controls) {
		display: flex;
	}
	:global(.ex-content .ex-controls .ex-search) {
		flex: 1 1 0;
	}
</style>
