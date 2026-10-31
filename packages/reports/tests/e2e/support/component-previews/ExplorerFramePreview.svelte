<script lang="ts">
	import ExplorerFrame from '../../../../src/components/explorer-ui/ExplorerFrame.svelte';
	import type { ComponentProps } from 'svelte';
	import { entity } from './explorerData';
	let { props }: { props: ComponentProps<typeof ExplorerFrame> } = $props();
</script>

<ExplorerFrame {...props}>
	{#snippet children(nav)}
		<button
			type="button"
			class="ex-text-button"
			onclick={(event) => nav.source?.(entity, entity.name, event.currentTarget)}
			>View OrderList source</button
		>
	{/snippet}
</ExplorerFrame>
