<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/** Says that there is nothing to show here, and why. */
	let { children }: { children: Snippet } = $props();
</script>

<hx-p class="ex-empty">{@render children()}</hx-p>

<style>
	.ex-empty :global(a) {
		display: inline-block;
		margin-inline-start: var(--hx-space-8);
	}
</style>
