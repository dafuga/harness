<!-- @harness-tier atom -->
<!-- @harness-element abbr -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'abbr'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
