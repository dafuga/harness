<script lang="ts">
	import CategoryImplementation from '../networking-security/remote-phone-panel/RemotePhonePanel.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
