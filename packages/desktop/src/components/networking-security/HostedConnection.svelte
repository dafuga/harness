<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createHostedConnectionStore } from '../../lib/stores/networking-security/hostedConnection.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	let { workspace, compact = false }: { workspace: Workspace; compact?: boolean } = $props();
	/**
	 * Shown only where the bridge can connect this device. The origin is the one the app was
	 * configured with: nothing here takes an address, and Google sign-in happens in the browser.
	 * One Google account brings the projects it owns and the ones it joined, on every device.
	 */
	const connection = createHostedConnectionStore(untrack(() => workspace));
	const status = $derived(connection.status);
	const synced = 'Projects you own or joined stay in sync on every device you connect.';
	onMount(() => {
		void connection.load();
		return () => connection.dispose();
	});
</script>

{#if connection.available && status}<hx-section
		class="hosted-connection"
		class:compact
		aria-label="Shared projects"
	>
		{#if !status.configured}<hx-span class="muted"
				>Shared projects are not set up for this app.</hx-span
			>{:else if status.state === 'signed-in'}<hx-span title={synced}
				>Shared projects · {status.actor?.name || 'connected'}</hx-span
			>{#if !compact}<hx-small class="muted">{synced}</hx-small>{/if}<hx-button
				type="button"
				disabled={connection.busy}
				onclick={() => void connection.disconnect()}>Disconnect</hx-button
			>{:else if status.state === 'pending' && status.handoff}<hx-span
				>Sign in with Google in your browser and type this code there:</hx-span
			><hx-strong class="user-code">{status.handoff.userCode}</hx-strong
			>{#if connection.address}<hx-span
					>Open <hx-span class="hosted-address">{connection.address}</hx-span></hx-span
				>{:else}<hx-span class="error" role="alert"
					>The sign-in address this app received is not valid, so it is not shown.</hx-span
				>{/if}<hx-small
				>{connection.expired
					? 'This code has expired. Cancel and connect again.'
					: 'Waiting for your approval…'}</hx-small
			><hx-button
				type="button"
				disabled={connection.busy}
				onclick={() => void connection.disconnect()}>Cancel</hx-button
			>{:else}{#if !compact}<hx-small class="muted"
					>Sign in with Google to open the projects you own and the ones you were invited to. They
					stay in sync on every device you connect.</hx-small
				>{/if}<hx-button
				type="button"
				disabled={connection.busy}
				onclick={() => void connection.connect()}>Connect shared projects</hx-button
			>{/if}{#if connection.error}<hx-span class="error" role="alert">{connection.error}</hx-span
			>{/if}
	</hx-section>{/if}
