<script lang="ts">
	import type { Component } from 'svelte';
	// Stands in for the console in a test of its host: it shows the address it was given, and
	// draws the screen it was handed, when it was handed one.
	let { base, path, content: Screen }: { base: string; path: string; content?: Component } =
		$props();
</script>

<output data-mount={base}>{path}</output>
{#if Screen}<Screen />{:else}<output data-screen="none">no screen was handed over</output>{/if}
