<!-- @harness-tier atom -->
<!-- @harness-element datalist -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'datalist'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
