<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import EmptyState from '../../explorer-ui/explorer-kit/EmptyState.svelte';
	/** The written steps for setting up a plugin or generating one of its resources. */
	let { lines }: { lines: string[] } = $props();
</script>

{#if lines.length}
	<hx-ul class="ex-reasons mod-steps">
		{#each lines as line, position (position)}<hx-li>{line}</hx-li>{/each}
	</hx-ul>
{:else}
	<hx-div class="mod-steps"><EmptyState>No steps provided.</EmptyState></hx-div>
{/if}

<style>
	.mod-steps {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
</style>
