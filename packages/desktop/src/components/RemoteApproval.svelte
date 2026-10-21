<script lang="ts">
	import CategoryImplementation from './networking-security/RemoteApproval.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
