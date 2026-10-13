<script lang="ts">
	import type { RemoteHost } from '../lib/stores/remoteHost.svelte';
	import type { RemotePairingRequest } from '../models/Environment.types';
	import { identityLabel } from '../utils/remoteLabels';
	let {
		request,
		projects,
		store
	}: {
		request: RemotePairingRequest;
		projects: { id: string; name: string }[];
		store: RemoteHost;
	} = $props();
	/**
	 * Nothing is granted by default: each project and the agents permission is chosen here. The
	 * whole identity of the asking phone is shown, so that it can be compared with the phone.
	 */
	let chosen = $state<string[]>([]);
	let agents = $state(false);
	const heading = $derived(`${request.deviceName} asks to connect`);
	const none = 'Add a local project first. Only projects on this computer can be granted.';
	/** The approval names the identity that is shown here, so that no other request can take it. */
	function approve() {
		const { pairingId, deviceId } = request;
		void store.approve({ pairingId, deviceId, projectIds: [...chosen], agents });
	}
</script>

<fieldset class="remote-request" aria-label={heading}>
	<strong>{heading}</strong>
	<small class="muted">Key {identityLabel(request.deviceId)} · {request.platform}</small>
	<span>May read and comment in:</span>
	{#each projects as item (item.id)}<label
			><input type="checkbox" bind:group={chosen} value={item.id} /> {item.name}</label
		>{/each}{#if !projects.length}<small class="muted">{none}</small>{/if}
	<label><input type="checkbox" bind:checked={agents} /> May run Plan and Change agents</label>
	<div class="remote-actions">
		<button type="button" class="primary" disabled={store.busy || !chosen.length} onclick={approve}
			>Approve</button
		><button type="button" disabled={store.busy} onclick={() => void store.deny(request.pairingId)}
			>Deny</button
		>
	</div>
</fieldset>
