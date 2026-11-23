<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_q7k4xia3g7 -->
<script lang="ts">
	import { getContext } from 'svelte';
	import Modal from '$shared/Modal.svelte';
	import type { RemotePhone } from '../../../lib/stores/networking-security/remotePhone.svelte';
	import {
		nativeAccountContext,
		type NativeAccountContext
	} from '../../../models/development-tooling/Environment.types';
	import { grantSummary, remoteLabels } from './remoteLabels';
	import { identityLabel } from '../../../helpers/networking-security/identityLabel';
	let { store, compact = false }: { store: RemotePhone; compact?: boolean } = $props();
	/**
	 * This phone's connection to a computer. A person names the phone and scans the code the
	 * computer shows; no link, code or address is typed here, and none reaches the page. What the
	 * phone may do is decided on the computer. Only an online computer is called connected.
	 */
	let deviceName = $state('iPhone');
	/** The Connection dialog of a connected phone: its details, Disconnect and Sign out. */
	let connection = $state(false);
	const account = getContext<NativeAccountContext | undefined>(nativeAccountContext);
	const status = $derived(store.status);
	const labels = $derived(status ? remoteLabels(status) : null);
	const actions = { 'pending-approval': 'Cancel', pairing: 'Cancel', revoked: 'Connect again' };
	const action = $derived(
		(status && actions[status.state as keyof typeof actions]) || 'Disconnect'
	);
	/** The footer's one line: a connected computer and this phone; the awake note lives in the dialog. */
	const compactTitle = $derived.by(() => {
		if (!labels) return '';
		return status?.state === 'online' && status.device
			? `${labels.title} · ${status.device.name}`
			: labels.title;
	});
	const how =
		'In Harness on your computer, turn on phone access and choose Pair a phone. Then scan the code it shows.';
	const fixture = 'Debug build for a test fixture: a relay on this machine is accepted.';
</script>

{#snippet failure()}
	{#if store.error}<hx-span class="error" role="alert">{store.error}</hx-span>{/if}
{/snippet}

{#if status && labels}
	{#if compact}
		{#if status.state !== 'unpaired'}<hx-section
				class="remote-connection compact"
				aria-label="Computer connection"
			>
				<hx-span class="remote-title">{compactTitle}</hx-span>
				{#if labels.detail && status.state !== 'online'}<hx-small class="remote-note"
						>{labels.detail}</hx-small
					>{/if}
				<hx-button type="button" disabled={store.busy} onclick={() => void store.disconnect()}
					>{action}</hx-button
				>
				{@render failure()}
			</hx-section>{/if}
	{:else if status.state === 'online'}
		<hx-section class="remote-connection" aria-label="Computer connection">
			<hx-button
				type="button"
				class="quiet remote-chip"
				aria-haspopup="dialog"
				onclick={() => (connection = true)}>{labels.title}</hx-button
			>
			{@render failure()}
		</hx-section>
		<Modal open={connection} title="Connection" variant="text" onClose={() => (connection = false)}>
			<hx-div class="connection-body">
				{#if labels.detail}<hx-p>{labels.detail}</hx-p>{/if}
				{#if status.grant}<hx-p>{grantSummary(status.grant)}</hx-p>{/if}
				{#if status.device}<hx-p class="muted">This phone: {status.device.name}</hx-p>
					<hx-p class="muted remote-key">Key {identityLabel(status.device.id)}</hx-p>{/if}
				<hx-div class="connection-actions">
					<hx-button type="button" disabled={store.busy} onclick={() => void store.disconnect()}
						>Disconnect</hx-button
					>
					<hx-button type="button" class="quiet" onclick={() => account?.signOut()}
						>Sign out</hx-button
					>
				</hx-div>
			</hx-div>
		</Modal>
	{:else}
		<hx-section class="remote-connection gate" aria-label="Computer connection">
			<hx-h2>{labels.title}</hx-h2>
			{#if status.state === 'unpaired'}
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
					>
					<hx-button class="primary" disabled={store.busy}
						>{store.scanFailure ? 'Scan again' : 'Scan QR code'}</hx-button
					>
				</hx-form>
			{:else}
				{#if labels.detail}<hx-p class="muted">{labels.detail}</hx-p>{/if}
				<hx-button type="button" disabled={store.busy} onclick={() => void store.disconnect()}
					>{action}</hx-button
				>
			{/if}
			{@render failure()}
			{#if store.fixture}<hx-small class="remote-note">{fixture}</hx-small>{/if}
		</hx-section>
	{/if}
{/if}

<style>
	.remote-connection:not(.compact) {
		display: grid;
		justify-items: center;
		gap: var(--hx-space-12);
		margin: 0;
		text-align: center;
	}
	.remote-chip {
		min-height: 44px;
	}
	.connection-body {
		display: grid;
		gap: var(--hx-space-12);
		text-align: start;
	}
	.connection-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-12);
	}
	.connection-actions button {
		min-height: 44px;
	}
	.remote-key {
		overflow-wrap: anywhere;
	}
</style>
