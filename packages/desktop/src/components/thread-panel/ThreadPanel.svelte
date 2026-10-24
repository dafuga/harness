<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from '../explorer-ui/thread-panel/ThreadPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let {
		thread = $bindable(null),
		target = $bindable(null),
		version = $bindable(''),
		option = $bindable(''),
		...props
	}: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:thread bind:target bind:version bind:option />
