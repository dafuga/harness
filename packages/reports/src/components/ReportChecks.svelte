<script lang="ts">
	import CategoryImplementation from './verification-evidence/ReportChecks.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
