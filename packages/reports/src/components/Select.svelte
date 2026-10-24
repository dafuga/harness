<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './shared-primitives/Select.svelte';
	import type { ComponentProps } from 'svelte';
	let { value = $bindable(''), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:value />
