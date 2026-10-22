<script lang="ts">
	import CategoryImplementation from '../networking-security/remote-host-panel/RemoteHostPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
