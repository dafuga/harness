<script lang="ts">
	import ExplorerIndex from '../../../../src/components/explorer-ui/explorer-index/ExplorerIndex.svelte';
	import type { ComponentProps } from 'svelte';
	let { props }: { props: ComponentProps<typeof ExplorerIndex> } = $props();
</script>

<ExplorerIndex {...props}>
	{#snippet list(listed)}
		<ul>
			{#each listed as row (row.id)}<li>{row.name}</li>{/each}
		</ul>
	{/snippet}
</ExplorerIndex>
