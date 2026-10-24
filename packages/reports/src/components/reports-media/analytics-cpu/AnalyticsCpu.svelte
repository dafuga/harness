<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { CpuSnapshot } from '../../../../../../src/utils/cpuMetrics';
	import { analyticsCpuClient } from './analyticsCpuClient';
	let snapshot = $state<CpuSnapshot | null>(null);
	let pending = $state(true);
	let client: ReturnType<typeof analyticsCpuClient> | undefined;
	let cpu = $derived(snapshot?.status === 'available' ? snapshot : null);
	const percent = (value: number | null) =>
		value === null ? 'Not measured' : value.toFixed(1) + '%';
	function refresh() {
		if (!client) return;
		if (!cpu) pending = true;
		void client.refresh();
	}
	onMount(() => {
		// A failed sample arrives as null and replaces the last reading, so nothing stale is shown.
		client = analyticsCpuClient((sample) => {
			snapshot = sample;
			pending = false;
		});
		return client.stop;
	});
</script>

<hx-section class="analytics-section" data-harness-component="analytics-cpu">
	<hx-div class="analytics-heading">
		<hx-h2>Live CPU usage</hx-h2>
		<hx-button type="button" onclick={refresh}>Refresh CPU</hx-button>
	</hx-div>
	{#if pending}
		<hx-p class="analytics-empty" role="status">Sampling CPU…</hx-p>
	{:else if cpu}
		<hx-div class="analytics-grid analytics-tiles">
			<hx-div class="analytics-card analytics-accent" data-testid="cpu-machine">
				<hx-span class="analytics-label">Whole machine</hx-span>
				<hx-strong class="analytics-value" class:analytics-quiet={cpu.machinePercent === null}>
					{percent(cpu.machinePercent)}
				</hx-strong>
				<hx-small>All processes on this machine</hx-small>
			</hx-div>
			{#each cpu.groups as group}
				<hx-div class="analytics-card" data-testid={'cpu-' + group.id}>
					<hx-span class="analytics-label">{group.label}</hx-span>
					<hx-strong class="analytics-value">{percent(group.machinePercent)}</hx-strong>
					<hx-small
						>{group.id === 'agents' ? 'This repository' : 'All projects on this machine'} · Core
						{percent(group.corePercent)} · Processes {group.processes}</hx-small
					>
				</hx-div>
			{/each}
			<hx-div class="analytics-card" data-testid="cpu-tracked">
				<hx-span class="analytics-label">Tracked combined</hx-span>
				<hx-strong class="analytics-value">{percent(cpu.trackedPercent)}</hx-strong>
				<hx-small
					>Machine-wide Codex and Harness plus this repository's agents; not a figure of this
					repository</hx-small
				>
			</hx-div>
		</hx-div>
		<hx-p class="analytics-note">
			Large figures are machine %, the share across all cores. Core % counts 100% as one full core.
		</hx-p>
		<hx-p class="analytics-meta">
			<hx-span>Sampled {cpu.sampledAt.slice(11, 19)} UTC</hx-span>
			<hx-span>{cpu.logicalCores} logical cores</hx-span>
			<hx-span>{(cpu.intervalMs / 1000).toFixed(1)} s sample interval</hx-span>
			<hx-span>Auto-refreshes every 5 s while this tab is visible</hx-span>
		</hx-p>
		<hx-div class="panel analytics-grid">
			<hx-div class="analytics-heading">
				<hx-h3>Agents working in this repository</hx-h3>
				<hx-span class="analytics-note"
					>One row per agent process tree running in a checkout of this application. The machine
					total above covers everything on this computer.</hx-span
				>
			</hx-div>
			{#if cpu.agents.length}
				<hx-div class="analytics-scroll">
					<hx-table class="analytics-table">
						<hx-thead>
							<hx-tr>
								<hx-th>Agent</hx-th>
								<hx-th class="analytics-num">PID</hx-th>
								<hx-th class="analytics-num">Processes</hx-th>
								<hx-th class="analytics-num">Core %</hx-th>
								<hx-th class="analytics-num">Machine %</hx-th>
							</hx-tr>
						</hx-thead>
						<hx-tbody>
							{#each cpu.agents as agent}
								<hx-tr>
									<hx-td class="analytics-wrap">{agent.label}</hx-td>
									<hx-td class="analytics-num">{agent.pid}</hx-td>
									<hx-td class="analytics-num">{agent.processes}</hx-td>
									<hx-td class="analytics-num">{percent(agent.corePercent)}</hx-td>
									<hx-td class="analytics-num">{percent(agent.machinePercent)}</hx-td>
								</hx-tr>
							{/each}
						</hx-tbody>
					</hx-table>
				</hx-div>
			{:else}
				<hx-p class="analytics-empty">No agent was working in this repository in this sample.</hx-p>
			{/if}
		</hx-div>
	{:else}
		<hx-div class="notice analytics-alert" role="alert">
			<hx-strong>CPU usage unavailable</hx-strong>
			<hx-span>No sample could be read, so no figures are shown.</hx-span>
			<hx-button type="button" onclick={refresh}>Retry</hx-button>
		</hx-div>
	{/if}
	<hx-p class="analytics-note">
		Measures local processes only and ignores the history filters. The shared Codex app-server's CPU
		cannot be split by chat, and cloud model inference CPU is not measured. Samples are not
		automatically saved or published.
	</hx-p>
</hx-section>
