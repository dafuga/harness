<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pqvytes3sn -->
<script lang="ts">
	import type { RemoteHost } from '../../../lib/stores/networking-security/remoteHost.svelte';
	import { hostLine, hostSummary } from './remoteLabels';
	import { lockNote } from '../../../utils/networking-security/remoteLabels';
	import RemoteDevices from '../RemoteDevices.svelte';
	let { store, compact = false }: { store: RemoteHost; compact?: boolean } = $props();
	let open = $state(false);
	const status = $derived(store.status);
	const unavailable = 'Device linking is unavailable on this Mac.';
</script>

{#if status}<hx-section class="remote-connection" class:compact aria-label="Linked devices">
		{#if compact}<hx-span>{hostSummary(status)}</hx-span><hx-button
				type="button"
				aria-expanded={open}
				aria-label="Manage linked devices"
				onclick={() => (open = !open)}>{open ? 'Close' : 'Manage'}</hx-button
			>{/if}{#if !compact || open}<hx-div class="remote-body" class:remote-sheet={compact}>
				{#if !status.supported}<hx-span class="muted">{status.reason || unavailable}</hx-span
					>{:else if status.state === 'registering'}<hx-small class="remote-note"
						>Linking this Mac…</hx-small
					>{:else if !status.enabled}<hx-span>This Mac is unlinked.</hx-span
					>{#if status.reason}<hx-small class="remote-note">{status.reason}</hx-small
						>{/if}<hx-button type="button" disabled={store.busy} onclick={() => void store.enable()}
						>Link this Mac</hx-button
					>{:else}<hx-span>{hostLine(status)}</hx-span
					>{#if status.reason && status.state !== 'online'}<hx-small class="remote-note"
							>{status.reason}</hx-small
						>{/if}<hx-small class="muted">{lockNote}</hx-small><RemoteDevices
						devices={status.devices}
						projects={status.projects}
						{store}
					/>
					<hx-div class="remote-actions">
						<hx-button type="button" disabled={store.busy} onclick={() => void store.disable()}
							>Unlink this Mac</hx-button
						>
					</hx-div>{/if}{#if store.error}<hx-span class="error" role="alert">{store.error}</hx-span
					>{/if}
			</hx-div>{/if}
	</hx-section>{/if}
