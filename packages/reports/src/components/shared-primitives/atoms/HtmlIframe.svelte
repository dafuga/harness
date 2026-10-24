<!-- @harness-tier atom -->
<!-- @harness-element iframe -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'iframe'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
