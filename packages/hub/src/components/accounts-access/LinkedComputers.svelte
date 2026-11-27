<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_tctvnvpwgz -->
<script lang="ts">
	import DeviceListRow from '$shared/accounts-access/DeviceListRow.svelte';
	import Modal from '$shared/Modal.svelte';
	import type { RemoteAccountComputer } from '../../../../remote/src/models/networking-security/RemoteControl.types';
	import { BrowserComputerService } from '../../services/networking-security/BrowserComputerService';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	const { session, api } = browserContext();
	const hosts = '/api/remote/hosts';
	let linked = $state<{ actor: string; computers: RemoteAccountComputer[] }>();
	const computers = $derived(linked?.actor === session.actor?.id ? linked?.computers : undefined);
	let computerError = $state('');
	let selected = $state<RemoteAccountComputer>();
	let projects = $state<{ id: string; name: string }[]>();
	let unlink = $state(false);
	let unlinking = $state(false);
	let connection: BrowserComputerService | undefined;

	async function loadComputers(actor: string) {
		try {
			const reply = await api.get<{ computers: RemoteAccountComputer[] }>(hosts, { linked: '1' });
			if (session.actor?.id === actor) linked = { actor, computers: reply.computers };
		} catch (error) {
			if (session.actor?.id !== actor) return;
			const disabled = (error as { code?: string }).code === 'remote-disabled';
			if (disabled) linked = { actor, computers: [] };
			else computerError = 'Could not load linked computers.';
		}
	}

	function closeComputer() {
		connection?.close();
		connection = undefined;
		selected = projects = undefined;
		unlink = false;
		computerError = '';
	}

	async function connect(computer: RemoteAccountComputer) {
		closeComputer();
		selected = computer;
		const active = new BrowserComputerService(api);
		connection = active;
		const lost = () => {
			if (connection !== active) return;
			active.close();
			projects = undefined;
			computerError = 'The computer connection ended.';
		};
		try {
			const listed = await active.connect(computer.hostId, lost);
			if (connection === active && !computerError) projects = listed;
		} catch {
			if (connection === active && !computerError)
				computerError = 'Could not connect to this computer.';
		}
	}

	async function unlinkComputer() {
		const actor = session.actor?.id;
		if (!selected || !actor || unlinking) return;
		const { hostId } = selected;
		unlinking = true;
		try {
			await api.send('DELETE', hosts + '/' + hostId);
			if (session.actor?.id !== actor) return;
			closeComputer();
			await loadComputers(actor);
		} catch {
			if (session.actor?.id === actor) computerError = 'Could not unlink this computer.';
		} finally {
			unlinking = false;
		}
	}

	$effect(() => {
		const actor = session.actor?.id;
		if (actor) void loadComputers(actor);
		return closeComputer;
	});
</script>

<hx-section class="hub-list" aria-labelledby="hub-computers-title">
	<hx-div class="hub-list-head"><hx-h2 id="hub-computers-title">Linked computers</hx-h2></hx-div>
	{#if computers?.length}
		<hx-ul aria-label="Linked computers">
			{#each computers as computer (computer.hostId)}
				<DeviceListRow name={computer.name} status={computer.online ? 'Online' : 'Offline'}>
					{#if computer.online}
						<hx-button
							type="button"
							aria-label={`Connect to ${computer.name}`}
							onclick={() => void connect(computer)}>Connect</hx-button
						>
					{:else}
						<hx-button
							type="button"
							aria-label={`Manage ${computer.name}`}
							onclick={() => {
								closeComputer();
								selected = computer;
								unlink = true;
							}}>Manage</hx-button
						>
					{/if}
				</DeviceListRow>
			{/each}
		</hx-ul>
	{:else if computers}
		<hx-p class="hub-list-empty">Sign in to Harness on your Mac to link it.</hx-p>
	{:else if !computerError}
		<hx-p class="hub-list-empty" role="status">Loading computers…</hx-p>
	{/if}
	{#if computerError && !selected}<hx-p class="hub-list-empty" role="alert">{computerError}</hx-p
		>{/if}
</hx-section>
{#if selected}
	<Modal open title={selected.name} variant="text" onClose={closeComputer}>
		{#if computerError}<hx-p role="alert">{computerError}</hx-p>
		{:else if projects}
			{#if projects.length}
				<hx-ul aria-label="Projects on this Mac">
					{#each projects as project (project.id)}<hx-li>{project.name}</hx-li>{/each}
				</hx-ul>
			{:else}<hx-p>No projects open on this Mac.</hx-p>{/if}
		{:else if selected.online}
			<hx-p role="status">Connecting…</hx-p>
		{/if}
		<hx-div class="hub-list-meta">
			{#if unlink}
				<hx-button type="button" disabled={unlinking} onclick={() => void unlinkComputer()}
					>Confirm unlink</hx-button
				>
				<hx-button type="button" disabled={unlinking} onclick={closeComputer}>Cancel</hx-button>
			{:else}
				<hx-button type="button" onclick={() => (unlink = true)}>Unlink this Mac</hx-button>
			{/if}
		</hx-div>
	</Modal>
{/if}
