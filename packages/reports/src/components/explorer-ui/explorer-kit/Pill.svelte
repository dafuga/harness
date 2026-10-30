<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/** A short inline label in the explorer pill style; `state` is exposed for styling. */
	let {
		tone = '',
		state,
		children
	}: { tone?: string; state?: string; children: Snippet } = $props();
</script>

<hx-span class={tone ? `ex-pill ${tone}` : 'ex-pill'} data-state={state}
	>{@render children()}</hx-span
>
