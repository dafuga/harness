<!-- @harness-tier atom -->
<!-- @harness-element meta -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'meta'} {...attributes}>

</svelte:element>
