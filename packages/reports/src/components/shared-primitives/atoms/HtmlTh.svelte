<!-- @harness-tier atom -->
<!-- @harness-element th -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'th'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
