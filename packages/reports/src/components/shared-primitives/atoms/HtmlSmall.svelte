<!-- @harness-tier atom -->
<!-- @harness-element small -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'small'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
