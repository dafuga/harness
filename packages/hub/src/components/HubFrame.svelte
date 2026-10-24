<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './shared-primitives/HubFrame.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
