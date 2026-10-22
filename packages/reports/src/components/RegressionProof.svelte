<script lang="ts">
	import CategoryImplementation from './verification-evidence/RegressionProof.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
