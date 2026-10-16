<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createHostedConnectionStore } from '../lib/stores/hostedConnection.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { workspace, compact = false }: { workspace: Workspace; compact?: boolean } = $props();
	/**
	 * Shown only where the bridge can connect this device. The origin is the one the app was
	 * configured with: nothing here takes an address, and Google sign-in happens in the browser.
	 */
	const connection = createHostedConnectionStore(untrack(() => workspace));
	const status = $derived(connection.status);
	onMount(() => {
		void connection.load();
		return () => connection.dispose();
	});
</script>

{#if connection.available && status}<section
		class="hosted-connection"
		class:compact
		aria-label="Shared projects"
	>
		{#if !status.configured}<span class="muted">Shared projects are not set up for this app.</span
			>{:else if status.state === 'signed-in'}<span
				>Shared projects · {status.actor?.name || 'connected'}</span
			><button type="button" disabled={connection.busy} onclick={() => void connection.disconnect()}
				>Disconnect</button
			>{:else if status.state === 'pending' && status.handoff}<span
				>Sign in with Google in your browser and type this code there:</span
			><strong class="user-code">{status.handoff.userCode}</strong>{#if connection.address}<span
					>Open <span class="hosted-address">{connection.address}</span></span
				>{:else}<span class="error" role="alert"
					>The sign-in address this app received is not valid, so it is not shown.</span
				>{/if}<small
				>{connection.expired
					? 'This code has expired. Cancel and connect again.'
					: 'Waiting for your approval…'}</small
			><button type="button" disabled={connection.busy} onclick={() => void connection.disconnect()}
				>Cancel</button
			>{:else}<button
				type="button"
				disabled={connection.busy}
				onclick={() => void connection.connect()}>Connect shared projects</button
			>{/if}{#if connection.error}<span class="error" role="alert">{connection.error}</span>{/if}
	</section>{/if}
