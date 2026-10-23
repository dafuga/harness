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

<div
	class="ex-controls"
	role="search"
	aria-label={`Find ${noun}`}
	data-harness-component="harness-explorer-controls"
>
	<label class="ex-search">
		<HarnessIcon name="search" size={18} />
		<input
			type="search"
			placeholder={`Search ${noun}…`}
			aria-label={`Search ${noun}`}
			bind:value={filter.search}
		/>
	</label>
</div>

<style>
	:global(.ex-content .ex-controls) {
		display: flex;
	}
	:global(.ex-content .ex-controls .ex-search) {
		flex: 1 1 0;
	}
</style>
