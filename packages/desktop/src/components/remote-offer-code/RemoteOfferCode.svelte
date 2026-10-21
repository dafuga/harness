<script lang="ts">
	import CategoryImplementation from '../networking-security/remote-offer-code/RemoteOfferCode.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
