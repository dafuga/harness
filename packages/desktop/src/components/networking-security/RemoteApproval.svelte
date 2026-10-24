<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '../../../../reports/src/components/Select.svelte';
	import type { RemoteHost } from '../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemotePairingRequest } from '../../models/development-tooling/Environment.types';
	import { identityLabel } from '../../helpers/networking-security/identityLabel';
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

<hx-fieldset class="remote-request" aria-label={heading}>
	<hx-strong>{heading}</hx-strong>
	<hx-small class="muted">Key {identityLabel(request.deviceId)} · {request.platform}</hx-small>
	<hx-span>May access:</hx-span>
	{#each projects as item (item.id)}<hx-label
			><hx-input type="checkbox" bind:group={chosen} value={item.id} /> {item.name}</hx-label
		>{/each}{#if !projects.length}<hx-small class="muted">{none}</hx-small>{/if}
	<hx-label
		>Access<Select label="Device access" bind:value={access}
			><hx-option value="read">Read · browse only</hx-option><hx-option value="comment"
				>Comment · read and comment</hx-option
			><hx-option value="write">Write · read, comment and ask AI</hx-option></Select
		></hx-label
	>
	<hx-div class="remote-actions">
		<hx-button
			type="button"
			class="primary"
			disabled={store.busy || !chosen.length}
			onclick={approve}>Approve</hx-button
		><hx-button
			type="button"
			disabled={store.busy}
			onclick={() => void store.deny(request.pairingId)}>Deny</hx-button
		>
	</hx-div>
</hx-fieldset>
