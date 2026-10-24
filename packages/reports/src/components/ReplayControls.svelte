<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './reports-media/ReplayControls.svelte';
	import type { ComponentProps } from 'svelte';
	let { speed = $bindable(1), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:speed />
