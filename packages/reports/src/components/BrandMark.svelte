<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<!-- @harness-uid u_arg4actnbd -->
<script lang="ts">
	import CategoryImplementation from './shared-primitives/BrandMark.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
