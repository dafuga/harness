<script lang="ts">
	import type { RemoteHost } from '../lib/stores/remoteHost.svelte';
	import { hostLine, hostSummary, lockNote, shownCode } from '../utils/remoteLabels';
	import { timeLabel } from '../utils/timeLabel';
	import RemoteApproval from './RemoteApproval.svelte';
	import RemoteDevices from './RemoteDevices.svelte';
	let { store, compact = false }: { store: RemoteHost; compact?: boolean } = $props();
	/**
	 * Phone access to this computer. Nothing here takes an address or a command: the relay is the
	 * one the app was set up with, and a phone gets only the projects chosen for it.
	 */
	let open = $state(false);
	const status = $derived(store.status);
	const unavailable = 'Phone access is not available in this app.';
	const offerNote = 'Open this link on the phone and type the code there:';
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
						>{/if}<small class="muted">{lockNote}</small>{#if status.pairing}<span>{offerNote}</span
						><strong class="user-code">{shownCode(status.pairing.code)}</strong><span
							class="hosted-address">{status.pairing.link}</span
						><small class="muted">Expires {timeLabel(status.pairing.expiresAt)}</small
						>{/if}{#each status.requests as item (item.pairingId)}<RemoteApproval
							request={item}
							projects={status.projects}
							{store}
						/>{/each}<RemoteDevices devices={status.devices} projects={status.projects} {store} />
					<div class="remote-actions">
						<button
							type="button"
							disabled={store.busy || status.state !== 'online'}
							onclick={() => void store.createPairing()}>Pair a phone</button
						><button type="button" disabled={store.busy} onclick={() => void store.disable()}
							>Turn off phone access</button
						>
					</div>{/if}{#if store.error}<span class="error" role="alert">{store.error}</span>{/if}
			</div>{/if}
	</section>{/if}
