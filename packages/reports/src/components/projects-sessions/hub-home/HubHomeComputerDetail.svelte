<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_klyhoh45ns -->
<script lang="ts">
	import Modal from '../../shared-primitives/Modal.svelte';
	import DetailList from '../../shared-primitives/DetailList.svelte';
	import LinkifiedText from '../../shared-primitives/LinkifiedText.svelte';
	import type { HomeComputer } from '../../../lib/projects-sessions/hub-home/homeLive.types';
	import { count } from './hubHomePresentation';

	type ResourceReading = { label: string; value: string };

	let { machine, close }: { machine: HomeComputer; close: () => void } = $props();
	const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const resources = $derived(machine.resources ?? {});
	let { ramAvailableMB, ramTotalMB, cores, loadOne, diskFreeGB } = $derived(resources);
	const reading = $derived(
		[ramAvailableMB, ramTotalMB, cores, loadOne, diskFreeGB].some((value) => value !== undefined)
	);
	const ram = $derived(
		ramAvailableMB !== undefined && ramTotalMB !== undefined
			? `${number.format(ramAvailableMB / 1024)} GB free of ${number.format(ramTotalMB / 1024)} GB`
			: 'Not reported'
	);
	const cpu = $derived(
		cores !== undefined && loadOne !== undefined
			? `${number.format(loadOne)} load / ${count(cores, 'core')} · ${number.format(Math.max(0, cores - loadOne))} estimated free cores`
			: 'Not reported'
	);
	const disk = $derived(
		diskFreeGB === undefined ? 'Not reported' : `${number.format(diskFreeGB)} GB free`
	);
	const readings: ResourceReading[] = $derived([
		{ label: 'RAM', value: ram },
		{ label: 'CPU · 1 minute', value: cpu },
		{ label: 'Startup disk', value: disk }
	]);
	const sessions = $derived(machine.sessions ?? []);
	const unlisted = $derived(Math.max(0, (machine.agentCount ?? 0) - sessions.length));
</script>

<Modal isOpen title={machine.name} summary={machine.status} variant="section" onClose={close}>
	<hx-div class="hh-computer-detail" data-harness-component="hub-home-computer-detail">
		{#if machine.reasons?.length}
			<hx-p class="po-sessions">{machine.reasons.join(' · ')}</hx-p>
		{/if}
		{#if machine.status !== 'offline' && reading}
			<DetailList rows={readings} rowKey={(row) => row.label} className="hh-computer-readings">
				{#snippet label(row: ResourceReading)}{row.label}{/snippet}
				{#snippet children(row: ResourceReading)}{row.value}{/snippet}
			</DetailList>
		{:else}
			<hx-p class="po-sessions">No current resource reading</hx-p>
		{/if}
		<hx-section aria-label="Running sessions">
			<hx-h3 class="po-label">Running sessions</hx-h3>
			{#if sessions.length}
				<hx-ul class="po-items">
					{#each sessions as session (session.key)}
						<hx-li class="po-item">
							<hx-span class="po-item-title"><LinkifiedText text={session.title} /></hx-span>
							{#if session.origin && session.origin !== machine.name}
								<hx-span class="po-item-meta">From {session.origin}</hx-span>
							{/if}
						</hx-li>
					{/each}
				</hx-ul>
			{/if}
			{#if unlisted}
				<hx-p class="po-sessions">{count(unlisted, 'session')} without listed details</hx-p>
			{:else if !sessions.length}
				<hx-p class="po-sessions"
					>{machine.agentCount === 0 ? 'Nothing running' : 'No current session reading'}</hx-p
				>
			{/if}
		</hx-section>
	</hx-div>
</Modal>

<style>
	:global(.hh-home dialog.hh-dialog:has(> .hh-dialog-body > .hh-computer-detail)) {
		width: min(480px, calc(100% - var(--hx-space-32)));
		height: fit-content;
		max-height: calc(100dvh - var(--hx-space-32));
		margin: auto;
		border-radius: var(--hx-radius-xlarge);
	}
	.hh-computer-detail :global(.hh-computer-readings) {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--hx-space-12);
	}
	.hh-computer-detail,
	.hh-computer-detail section {
		display: grid;
		gap: var(--hx-space-12);
	}
	.hh-computer-detail .po-item {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--hx-space-8);
		padding-block: var(--hx-space-8);
	}
	.hh-computer-detail .po-item-title {
		overflow-wrap: anywhere;
	}
</style>
