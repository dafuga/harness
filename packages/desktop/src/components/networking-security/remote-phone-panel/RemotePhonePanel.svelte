<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { RemotePhone } from '../../../lib/stores/networking-security/remotePhone.svelte';
	import { grantSummary, remoteLabels } from './remoteLabels';
	import { identityLabel } from '../../../helpers/networking-security/identityLabel';
	let { store, compact = false }: { store: RemotePhone; compact?: boolean } = $props();
	/**
	 * This phone's connection to a computer. A person names the phone and scans the code the
	 * computer shows; no link, code or address is typed here, and none reaches the page. What the
	 * phone may do is decided on the computer. Only an online computer is called connected.
	 */
	let deviceName = $state('iPhone');
	const status = $derived(store.status);
	const labels = $derived(status ? remoteLabels(status) : null);
	const actions = { 'pending-approval': 'Cancel', pairing: 'Cancel', revoked: 'Connect again' };
	const action = $derived(
		(status && actions[status.state as keyof typeof actions]) || 'Disconnect'
	);
	const how =
		'In Harness on your computer, turn on phone access and choose Pair a phone. Then scan the code it shows.';
	const fixture = 'Debug build for a test fixture: a relay on this machine is accepted.';
</script>

{#if status && labels}<hx-section
		class="remote-connection"
		class:compact
		aria-label="Computer connection"
	>
		{#if status.state === 'unpaired'}{#if !compact}<hx-h2>{labels.title}</hx-h2>
				<hx-p class="muted">{how}</hx-p>
				{#if status.reason}<hx-span class="error" role="alert">{status.reason}</hx-span>{/if}
				<hx-form
					onsubmit={(event) => {
						event.preventDefault();
						void store.scan(deviceName);
					}}
				>
					<hx-label
						>Name of this phone<hx-input
							type="text"
							bind:value={deviceName}
							maxlength="80"
						/></hx-label
					><hx-button class="primary" disabled={store.busy}
						>{store.scanFailure ? 'Scan again' : 'Scan QR code'}</hx-button
					>
				</hx-form>{/if}{:else}<hx-span class="remote-title">{labels.title}</hx-span
			>{#if labels.detail}<hx-small class:remote-note={status.state !== 'online'}
					>{labels.detail}</hx-small
				>{/if}{#if !compact && status.grant}<hx-small>{grantSummary(status.grant)}</hx-small
				>{/if}{#if !compact && status.device}<hx-small class="muted"
					>This phone: {status.device.name}</hx-small
				><hx-small class="muted remote-key">Key {identityLabel(status.device.id)}</hx-small
				>{/if}<hx-button type="button" disabled={store.busy} onclick={() => void store.disconnect()}
				>{action}</hx-button
			>{/if}{#if store.error}<hx-span class="error" role="alert">{store.error}</hx-span>{/if}
		{#if store.fixture && !compact}<hx-small class="remote-note">{fixture}</hx-small>{/if}
	</hx-section>{/if}
