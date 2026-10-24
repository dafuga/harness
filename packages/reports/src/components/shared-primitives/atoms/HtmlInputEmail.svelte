<!-- @harness-tier atom -->
<!-- @harness-element input email -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'input'} {...attributes} type="email">

</svelte:element>
