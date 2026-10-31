<script lang="ts">
	import ExplorerFrame from '../../../../src/components/explorer-ui/ExplorerFrame.svelte';
	import type { ComponentProps } from 'svelte';
	import { entity } from './explorerData';
	let { props }: { props: ComponentProps<typeof ExplorerFrame> } = $props();
</script>

<ExplorerFrame {...props}>
	{#snippet children(nav)}
		{#if props.registryRequired === false}
			<section aria-label="Platform declarations">
				<h2>Website</h2>
				<p>SvelteKit application · static hosting</p>
				<dl class="ex-rows">
					<div>
						<dt>Build</dt>
						<dd><code>bun run build</code></dd>
					</div>
					<div>
						<dt>Output directory</dt>
						<dd><code>build/</code></dd>
					</div>
				</dl>
			</section>
		{:else}
			<button
				type="button"
				class="ex-text-button"
				onclick={(event) => nav.source?.(entity, entity.name, event.currentTarget)}
				>View OrderList source</button
			>
		{/if}
	{/snippet}
</ExplorerFrame>
