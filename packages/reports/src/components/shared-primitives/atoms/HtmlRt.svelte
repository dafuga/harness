<!-- @harness-tier atom -->
<!-- @harness-element rt -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'rt'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
