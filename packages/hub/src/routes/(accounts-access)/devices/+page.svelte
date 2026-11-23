<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_xzmlyw4yjt -->
<script lang="ts">
	import LoginPanel from '../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import HubFrame from '../../../components/shared-primitives/HubFrame.svelte';
	import type { AccountDevice } from '../../../models/accounts-access/HubAuth.types';
	import { browserContext } from '../../../utils/development-tooling/browserContext';

	const { session, api } = browserContext();
	const endpoint = '/api/auth/native/devices';
	let listed = $state<{ actor: string; devices: AccountDevice[] }>();
	const devices = $derived(listed?.actor === session.actor?.id ? listed?.devices : undefined);
	let removing = $state<string>();
	let confirm = $state<string>();
	let error = $state('');

	async function load(actor: string) {
		error = '';
		try {
			const result = await api.get<{ devices: AccountDevice[] }>(endpoint);
			if (session.actor?.id === actor) listed = { actor, devices: result.devices };
		} catch {
			if (session.actor?.id === actor) error = 'Could not load devices.';
		}
	}

	$effect(() => {
		const actor = session.actor?.id;
		if (actor) void load(actor);
	});

	async function remove(id: string) {
		if (removing || !session.actor) return;
		const actor = session.actor.id;
		removing = id;
		error = '';
		try {
			await api.send('POST', endpoint, { id });
			if (session.actor?.id === actor) {
				confirm = undefined;
				await load(actor);
			}
		} catch {
			if (session.actor?.id === actor) error = 'Could not remove the device.';
		} finally {
			removing = undefined;
		}
	}
</script>

<svelte:head><title>Harness · Devices</title></svelte:head>
<HubFrame>
	{#if !session.actor}
		<LoginPanel reason="Sign in with Google to manage the devices on your account." />
	{:else}
		<hx-h1>Devices</hx-h1>
		{#if error}<hx-p role="alert">{error}</hx-p>{/if}
		{#if devices?.length}
			<hx-ul class="device-list" aria-label="Signed-in devices">
				{#each devices as device (device.id)}
					<hx-li class="hub-card device">
						<hx-div>
							<hx-strong>{device.name}</hx-strong>
							<hx-p class="muted"
								>Last seen <hx-span>
									{new Date(device.lastSeenAt).toLocaleString()}
								</hx-span></hx-p
							>
						</hx-div>
						{#if confirm === device.id}
							<hx-button
								type="button"
								disabled={Boolean(removing)}
								onclick={() => void remove(device.id)}>Confirm removal</hx-button
							>
							<hx-button
								type="button"
								disabled={Boolean(removing)}
								onclick={() => (confirm = undefined)}>Cancel</hx-button
							>
						{:else}
							<hx-button
								type="button"
								aria-label={'Remove ' + device.name}
								onclick={() => (confirm = device.id)}>Remove</hx-button
							>
						{/if}
					</hx-li>
				{/each}
			</hx-ul>
		{:else if devices}
			<hx-p>No desktop or iOS devices are signed in.</hx-p>
		{:else if !error}
			<hx-p role="status">Loading devices…</hx-p>
		{/if}
	{/if}
</HubFrame>

<style>
	.device-list {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--hx-space-12);
	}
	.device {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--hx-space-12);
	}
</style>
