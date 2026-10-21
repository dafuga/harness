<script lang="ts">
	import CategoryImplementation from './reports-media/ReportView.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
