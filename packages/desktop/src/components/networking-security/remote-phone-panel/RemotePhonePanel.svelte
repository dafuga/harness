<script lang="ts">
	import type { RemotePhone } from '../../../lib/stores/networking-security/remotePhone.svelte';
	import { grantSummary, remoteLabels } from './remoteLabels';
	import { identityLabel } from '../../../utils/networking-security/remoteLabels';
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

{#if status && labels}<section
		class="remote-connection"
		class:compact
		aria-label="Computer connection"
	>
		{#if status.state === 'unpaired'}{#if !compact}<h2>{labels.title}</h2>
				<p class="muted">{how}</p>
				{#if status.reason}<span class="error" role="alert">{status.reason}</span>{/if}
				<form
					onsubmit={(event) => {
						event.preventDefault();
						void store.scan(deviceName);
					}}
				>
					<label
						>Name of this phone<input type="text" bind:value={deviceName} maxlength="80" /></label
					><button class="primary" disabled={store.busy}
						>{store.scanFailure ? 'Scan again' : 'Scan QR code'}</button
					>
				</form>{/if}{:else}<span class="remote-title">{labels.title}</span>{#if labels.detail}<small
					class:remote-note={status.state !== 'online'}>{labels.detail}</small
				>{/if}{#if !compact && status.grant}<small>{grantSummary(status.grant)}</small
				>{/if}{#if !compact && status.device}<small class="muted"
					>This phone: {status.device.name}</small
				><small class="muted remote-key">Key {identityLabel(status.device.id)}</small>{/if}<button
				type="button"
				disabled={store.busy}
				onclick={() => void store.disconnect()}>{action}</button
			>{/if}{#if store.error}<span class="error" role="alert">{store.error}</span>{/if}
		{#if store.fixture && !compact}<small class="remote-note">{fixture}</small>{/if}
	</section>{/if}
