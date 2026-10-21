<script lang="ts">
	import Select from '../../../../reports/src/components/Select.svelte';
	import type { RemoteHost } from '../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemotePairingRequest } from '../../models/development-tooling/Environment.types';
	import { identityLabel } from '../../utils/networking-security/remoteLabels';
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
	let access = $state('comment');
	const heading = $derived(`${request.deviceName} asks to connect`);
	const none = 'Add a local project first. Only projects on this computer can be granted.';
	/** The approval names the identity that is shown here, so that no other request can take it. */
	function approve() {
		const { pairingId, deviceId } = request;
		void store.approve({
			pairingId,
			deviceId,
			projectIds: [...chosen],
			agents: access === 'write',
			comments: access !== 'read'
		});
	}
</script>

<fieldset class="remote-request" aria-label={heading}>
	<strong>{heading}</strong>
	<small class="muted">Key {identityLabel(request.deviceId)} · {request.platform}</small>
	<span>May access:</span>
	{#each projects as item (item.id)}<label
			><input type="checkbox" bind:group={chosen} value={item.id} /> {item.name}</label
		>{/each}{#if !projects.length}<small class="muted">{none}</small>{/if}
	<label
		>Access<Select label="Device access" bind:value={access}
			><option value="read">Read · browse only</option><option value="comment"
				>Comment · read and comment</option
			><option value="write">Write · read, comment and ask AI</option></Select
		></label
	>
	<div class="remote-actions">
		<button type="button" class="primary" disabled={store.busy || !chosen.length} onclick={approve}
			>Approve</button
		><button type="button" disabled={store.busy} onclick={() => void store.deny(request.pairingId)}
			>Deny</button
		>
	</div>
</fieldset>
