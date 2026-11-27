<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_xzmlyw4yjt -->
<!-- @harness-view overview -->
<script lang="ts">
	import DeviceListRow from '$shared/accounts-access/DeviceListRow.svelte';
	import LinkedComputers from '../../../components/accounts-access/LinkedComputers.svelte';
	import { formatTime } from '$reports/helpers/strings/formatTime';
	import LoginPanel from '../../../components/accounts-access/login-panel/LoginPanel.svelte';
	import HubFrame from '../../../components/shared-primitives/HubFrame.svelte';
	import type { AccountDeviceInventory } from '../../../models/accounts-access/HubAuth.types';
	import { browserContext } from '../../../utils/development-tooling/browserContext';

	const { session, api } = browserContext();
	const endpoint = '/api/account/devices';
	let listed = $state<{ actor: string; inventory: AccountDeviceInventory }>();
	const inventory = $derived(listed?.actor === session.actor?.id ? listed?.inventory : undefined);
	let removing = $state<string>();
	let confirm = $state<string>();
	let error = $state('');

	async function load(actor: string) {
		error = '';
		try {
			const result = await api.get<AccountDeviceInventory>(endpoint);
			if (session.actor?.id === actor) listed = { actor, inventory: result };
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
<HubFrame section="Account">
	{#if !session.actor}
		<LoginPanel reason="Sign in with Google to manage the devices on your account." />
	{:else}
		<hx-h1>Devices</hx-h1>
		<hx-section class="hub-list" aria-labelledby="hub-devices-title">
			<hx-div class="hub-list-head"><hx-h2 id="hub-devices-title">Signed-in devices</hx-h2></hx-div>
			{#if inventory?.devices.length}
				<hx-ul aria-label="Signed-in devices">
					{#each inventory.devices as device (device.id)}
						<DeviceListRow name={device.name} status={`Last seen ${formatTime(device.lastSeenAt)}`}>
							{#if inventory.currentDeviceId === device.id}
								<hx-small>This browser</hx-small>
							{:else if confirm === device.id}
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
						</DeviceListRow>
					{/each}
				</hx-ul>
			{:else if inventory}
				<hx-p class="hub-list-empty">No devices are signed in.</hx-p>
			{:else if !error}
				<hx-p class="hub-list-empty" role="status">Loading devices…</hx-p>
			{/if}
			{#if error}<hx-p class="hub-list-empty" role="alert">{error}</hx-p>{/if}
		</hx-section>
		<LinkedComputers />
	{/if}
</HubFrame>
