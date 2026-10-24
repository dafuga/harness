<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './agents-providers/AgentControls.svelte';
	import type { ComponentProps } from 'svelte';
	let { choice = $bindable(null), ...props }: ComponentProps<typeof CategoryImplementation> =
		$props();
</script>

<CategoryImplementation {...props} bind:choice />
