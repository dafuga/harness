<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_q7k4xia3g7 -->
<script lang="ts">
	import { getContext } from 'svelte';
	import Modal from '$shared/Modal.svelte';
	import ChoiceRow from '../../shared-primitives/ChoiceRow.svelte';
	import type { RemoteAccountComputer } from '../../../../../remote/src/models/networking-security/RemoteControl.types';
	import type { RemotePhone } from '../../../lib/stores/networking-security/remotePhone.svelte';
	import {
		nativeAccountContext,
		type NativeAccountContext
	} from '../../../models/development-tooling/Environment.types';
	import { grantSummary, remoteLabels } from './remoteLabels';
	import { identityLabel } from '../../../helpers/networking-security/identityLabel';
	let { store, compact = false }: { store: RemotePhone; compact?: boolean } = $props();
	let connection = $state(false);
	const account = getContext<NativeAccountContext | undefined>(nativeAccountContext);
	const status = $derived(store.status);
	const discover = $derived(
		!compact && account?.signedIn && status?.state === 'unpaired'
			? store.port?.computers
			: undefined
	);
	let computers = $state<RemoteAccountComputer[]>([]);
	let discovery = $state<'loading' | 'ready' | 'failed'>('loading');
	let refresh = $state(0);
	$effect(() => {
		const list = discover;
		void refresh;
		if (!list) return;
		let active = true;
		discovery = 'loading';
		computers = [];
		void list().then(
			(found) => {
				if (!active) return;
				computers = found;
				discovery = 'ready';
			},
			() => {
				if (active) discovery = 'failed';
			}
		);
		return () => {
			active = false;
		};
	});
	const labels = $derived(status ? remoteLabels(status) : null);
	const actions = { 'pending-approval': 'Cancel', pairing: 'Cancel', revoked: 'Back to computers' };
	const action = $derived(
		(status && actions[status.state as keyof typeof actions]) || 'Disconnect'
	);
	const compactTitle = $derived.by(() => {
		if (!labels) return '';
		return status?.state === 'online' && status.device
			? `${labels.title} · ${status.device.name}`
			: labels.title;
	});
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
				{#if status.reason}<hx-span class="error" role="alert">{status.reason}</hx-span>{/if}
				{#if discover}
					<hx-div class="computer-list">
						{#each computers as computer (computer.hostId)}
							<ChoiceRow
								name={computer.name}
								meta={computer.online ? 'Online' : 'Offline'}
								label={`Connect to ${computer.name}`}
								disabled={store.busy || !computer.online}
								onchoose={() => void store.connectAccountComputer(computer.hostId, 'iPhone')}
							/>
						{:else}
							{#if discovery === 'loading'}
								<hx-small class="muted">Finding your computers…</hx-small>
							{:else if discovery === 'failed'}
								<hx-small class="muted">Could not find your computers.</hx-small>
							{:else}
								<hx-small class="muted"
									>No computers found. Sign in to Harness on your Mac.</hx-small
								>
							{/if}
						{/each}
						{#if discovery !== 'loading'}
							<hx-button type="button" class="quiet refresh" onclick={() => (refresh += 1)}
								>Refresh</hx-button
							>
						{/if}
					</hx-div>
				{/if}
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
	.computer-list {
		display: grid;
		width: 100%;
		gap: var(--hx-space-6);
	}
	.refresh {
		justify-self: center;
		min-height: 44px;
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
