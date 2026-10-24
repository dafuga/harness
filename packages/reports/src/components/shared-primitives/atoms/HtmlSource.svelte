<!-- @harness-tier atom -->
<!-- @harness-element source -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'source'} {...attributes}>

</svelte:element>
