<!-- @harness-tier atom -->
<!-- @harness-element wbr -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'wbr'} {...attributes}>

</svelte:element>
