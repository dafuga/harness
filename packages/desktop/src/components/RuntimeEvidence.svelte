<script lang="ts">
	import CategoryImplementation from './verification-evidence/RuntimeEvidence.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
