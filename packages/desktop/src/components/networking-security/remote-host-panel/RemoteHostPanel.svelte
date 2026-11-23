<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pqvytes3sn -->
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
	const vaultLabels = {
		pending: 'Waiting for iPhone',
		approved: 'Approved',
		denied: 'Denied',
		delivered: 'Approval delivered',
		expired: 'Expired',
		canceled: 'Canceled'
	};
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
					{#if status.vault}
						{@const vault = status.vault}
						<hx-section aria-label="Vault requests">
							<hx-h3>Vault requests</hx-h3>
							{#if vault.phone}
								<hx-p
									>Open Vault requests in Harness on {vault.phone.name} to review with Face ID.</hx-p
								>
								{#if !vault.phone.online}<hx-p>Connect {vault.phone.name} to this Mac.</hx-p>{/if}
								{#if !vault.requests}<hx-p>Vault status is unavailable.</hx-p>
								{:else if vault.requests.length === 0}<hx-p>No recent Vault requests.</hx-p>
								{:else}<hx-ul
										>{#each vault.requests as entry (entry.requestId)}
											<hx-li
												>{entry.site} · {entry.action} · {entry.requestId.slice(0, 8)} · {vaultLabels[
													entry.status
												]}</hx-li
											>
										{/each}</hx-ul
									>{/if}
							{:else}<hx-p>The iPhone configured for Vault is no longer paired.</hx-p>{/if}
							<hx-button type="button" disabled={store.busy} onclick={() => void store.refresh()}>
								Refresh Vault status
							</hx-button>
						</hx-section>
					{/if}
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
