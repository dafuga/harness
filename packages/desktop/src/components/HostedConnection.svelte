<script lang="ts">
	import CategoryImplementation from './networking-security/HostedConnection.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
