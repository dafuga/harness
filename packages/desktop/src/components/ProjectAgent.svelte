<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './agents-providers/ProjectAgent.svelte';
	import type { ComponentProps } from 'svelte';
	let { open = $bindable(false), ...props }: ComponentProps<typeof CategoryImplementation> =
		$props();
</script>

<CategoryImplementation {...props} bind:open />
