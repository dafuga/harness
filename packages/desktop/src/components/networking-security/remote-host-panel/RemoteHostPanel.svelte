<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { RemoteHost } from '../../../lib/stores/networking-security/remoteHost.svelte';
	import { hostLine, hostSummary } from './remoteLabels';
	import { lockNote } from '../../../utils/networking-security/remoteLabels';
	import RemoteApproval from '../RemoteApproval.svelte';
	import RemoteDevices from '../RemoteDevices.svelte';
	import RemoteOfferCode from '../remote-offer-code/RemoteOfferCode.svelte';
	let { store, compact = false }: { store: RemoteHost; compact?: boolean } = $props();
	/**
	 * Phone access to this computer. Nothing here takes an address or a command: the relay is the
	 * one the app was set up with, a phone pairs by scanning the code that is shown, and it gets
	 * only the projects chosen for it.
	 */
	let open = $state(false);
	const status = $derived(store.status);
	const unavailable = 'Phone access is not available in this app.';
	/** A code that a phone already scanned is spent: the request takes its place. */
	const scannable = $derived(
		status?.pairing && !status.requests.some((item) => item.pairingId === status.pairing?.pairingId)
			? status.pairing
			: null
	);
</script>

{#if status}<hx-section class="remote-connection" class:compact aria-label="Phone access">
		{#if compact}<hx-span>{hostSummary(status)}</hx-span><hx-button
				type="button"
				aria-expanded={open}
				aria-label="Manage phone access"
				onclick={() => (open = !open)}>{open ? 'Close' : 'Manage'}</hx-button
			>{/if}{#if !compact || open}<hx-div class="remote-body" class:remote-sheet={compact}>
				{#if !status.supported}<hx-span class="muted">{status.reason || unavailable}</hx-span
					>{:else if !status.enabled}<hx-span>Phone access is off.</hx-span
					>{#if status.reason}<hx-small class="remote-note">{status.reason}</hx-small
						>{/if}<hx-button type="button" disabled={store.busy} onclick={() => void store.enable()}
						>Turn on phone access</hx-button
					>{:else}<hx-span>{hostLine(status)}</hx-span
					>{#if status.reason && status.state !== 'online'}<hx-small class="remote-note"
							>{status.reason}</hx-small
						>{/if}<hx-small class="muted">{lockNote}</hx-small>{#if scannable}<RemoteOfferCode
							offer={scannable}
							{store}
						/>{/if}{#each status.requests as item (item.pairingId)}<RemoteApproval
							request={item}
							projects={status.projects}
							{store}
						/>{/each}<RemoteDevices devices={status.devices} projects={status.projects} {store} />
					<hx-div class="remote-actions">
						{#if !scannable}<hx-button
								type="button"
								disabled={store.busy || status.state !== 'online'}
								onclick={() => void store.createPairing()}>Pair a phone</hx-button
							>{/if}<hx-button
							type="button"
							disabled={store.busy}
							onclick={() => void store.disable()}>Turn off phone access</hx-button
						>
					</hx-div>{/if}{#if store.error}<hx-span class="error" role="alert">{store.error}</hx-span
					>{/if}
			</hx-div>{/if}
	</hx-section>{/if}
