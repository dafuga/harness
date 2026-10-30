<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/** A side note that qualifies what the screen shows, such as an incomplete reading. */
	let { children }: { children: Snippet } = $props();
</script>

<hx-p class="ex-notice" role="note">{@render children()}</hx-p>

<style>
	.ex-notice {
		color: var(--ex-soft);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
</style>
