<!-- @harness-tier atom -->
<!-- @harness-element embed -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'embed'} {...attributes}>

</svelte:element>
