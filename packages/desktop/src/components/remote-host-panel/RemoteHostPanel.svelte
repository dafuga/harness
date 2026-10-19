<script lang="ts">
	import type { RemoteHost } from "../../lib/stores/remoteHost.svelte.ts";
	import { hostLine, hostSummary } from "./remoteLabels";
import { lockNote } from "../../utils/remoteLabels";
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

{#if status}<section class="remote-connection" class:compact aria-label="Phone access">
		{#if compact}<span>{hostSummary(status)}</span><button
				type="button"
				aria-expanded={open}
				aria-label="Manage phone access"
				onclick={() => (open = !open)}>{open ? 'Close' : 'Manage'}</button
			>{/if}{#if !compact || open}<div class="remote-body" class:remote-sheet={compact}>
				{#if !status.supported}<span class="muted">{status.reason || unavailable}</span
					>{:else if !status.enabled}<span>Phone access is off.</span>{#if status.reason}<small
							class="remote-note">{status.reason}</small
						>{/if}<button type="button" disabled={store.busy} onclick={() => void store.enable()}
						>Turn on phone access</button
					>{:else}<span>{hostLine(status)}</span
					>{#if status.reason && status.state !== 'online'}<small class="remote-note"
							>{status.reason}</small
						>{/if}<small class="muted">{lockNote}</small>{#if scannable}<RemoteOfferCode
							offer={scannable}
							{store}
						/>{/if}{#each status.requests as item (item.pairingId)}<RemoteApproval
							request={item}
							projects={status.projects}
							{store}
						/>{/each}<RemoteDevices devices={status.devices} projects={status.projects} {store} />
					<div class="remote-actions">
						{#if !scannable}<button
								type="button"
								disabled={store.busy || status.state !== 'online'}
								onclick={() => void store.createPairing()}>Pair a phone</button
							>{/if}<button type="button" disabled={store.busy} onclick={() => void store.disable()}
							>Turn off phone access</button
						>
					</div>{/if}{#if store.error}<span class="error" role="alert">{store.error}</span>{/if}
			</div>{/if}
	</section>{/if}
