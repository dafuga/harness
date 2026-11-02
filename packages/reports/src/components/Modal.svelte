<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<!-- @harness-uid u_f6xsfq2f7u -->
<script lang="ts">
	import CategoryImplementation from './shared-primitives/Modal.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
