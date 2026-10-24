<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessExplanation, HarnessIndex } from '../../../models/explorer-ui/Harness.types';
	import type { HarnessClient } from '../../../utils/explorer-ui/harnessClient';
	import { harnessEmittedGrowth } from './harnessEmittedGrowth';
	import { growthMetrics, signed } from '../../../utils/explorer-ui/harnessGrowth';
	import { harnessGrowth, unitTimings } from './harnessGrowth';
	import Select from '../../shared-primitives/Select.svelte';
	import HarnessEmittedGrowth from '../HarnessEmittedGrowth.svelte';
	let {
		index,
		client,
		unit,
		onunit,
		oncompare = () => {}
	}: {
		/** Opens the comparison of a commit with the one before it, where its evidence is. */
		oncompare?: (commit: string) => void;
		index: HarnessIndex;
		client: HarnessClient;
		unit: string | null;
		onunit: (id: string) => void;
	} = $props();
	let current = $derived(unit ?? index.units[0]?.id ?? '');
	let rows = $derived(harnessGrowth(index, current));
	let emitted = $derived(harnessEmittedGrowth(index, current));
	let timings = $derived(unitTimings(index, current));
	let reasons = $state<Record<string, HarnessExplanation[]>>({});
	const profile = (id: string) => {
		const found = index.profiles.find((item) => item.id === id);
		return found ? `${found.platform} ${found.arch}, ${found.cpu}, ${found.runtime}` : id;
	};
	const subject = (commit: string) =>
		index.revisions.find((revision) => revision.commit === commit)?.subject ?? '';
	// Only the commits where something changed need their reasons, and only when they are shown.
	$effect(() => {
		const sized = emitted.rows.filter((row) => row.changed).map((row) => row.commit);
		const wanted = [...rows.filter((row) => row.changed).map((row) => row.commit), ...sized];
		const unitId = current;
		for (const commit of wanted) {
			void client.revision(commit).then((detail) => {
				const found = detail.explanations.filter((reason) => reason.unit === unitId);
				reasons = { ...reasons, [`${unitId}\n${commit}`]: found };
			});
		}
	});
</script>

<hx-section class="hc-card">
	<hx-label class="hc-field"
		>Component
		<Select label="Component" bind:value={() => current, onunit}>
			{#each index.units as item (item.id)}<hx-option value={item.id}>{item.id}</hx-option>{/each}
		</Select>
	</hx-label>
	<hx-div class="hc-table-wrap">
		<hx-table class="hc-table" aria-label={'Growth of ' + current}>
			<hx-thead>
				<hx-tr
					><hx-th>Commit</hx-th><hx-th>Source bytes</hx-th><hx-th>Complexity</hx-th><hx-th
						>Dependencies</hx-th
					><hx-th>Why</hx-th></hx-tr
				>
			</hx-thead>
			<hx-tbody>
				{#each rows as row, position (position)}
					<hx-tr>
						<hx-td
							>{row.commit.slice(0, 7)}<hx-br /><hx-span class="hc-muted">{row.subject}</hx-span
							></hx-td
						>
						{#each growthMetrics as metric (metric)}
							<hx-td
								>{row.values[metric] ?? 'unavailable'}
								{#if row.deltas[metric]}
									<hx-span class={(row.deltas[metric] ?? 0) > 0 ? 'hc-up' : 'hc-down'}
										>{signed(row.deltas[metric])}</hx-span
									>
								{/if}
								{#if row.notes[metric]}
									<hx-br /><hx-span class="hc-muted">{row.notes[metric]}</hx-span>
								{/if}</hx-td
							>
						{/each}
						<hx-td>
							{#each reasons[`${current}\n${row.commit}`] ?? [] as reason, position (position)}
								<hx-div>{reason.behavior}</hx-div>
							{/each}
							{#if row.changed}
								<hx-button type="button" class="hc-chip" onclick={() => oncompare(row.commit)}
									>Evidence before and after</hx-button
								>
							{/if}
							{#if row.changed && !(reasons[`${current}\n${row.commit}`] ?? []).length}
								<hx-span class="hc-muted">No reason is recorded.</hx-span>
							{/if}
						</hx-td>
					</hx-tr>
				{/each}
			</hx-tbody>
		</hx-table>
	</hx-div>
	{#if rows.length === 0}<hx-p class="hc-muted">No record has measured this component.</hx-p>{/if}
</hx-section>
{#if emitted.targets.length}
	<HarnessEmittedGrowth
		unit={current}
		growth={emitted}
		reasons={(commit) => reasons[`${current}\n${commit}`] ?? []}
		{oncompare}
	/>
{/if}
<hx-section class="hc-card hc-panel" aria-label={'Timings of ' + current}>
	<hx-h2>Timings</hx-h2>
	{#if timings.length === 0}
		<hx-p class="hc-muted"
			>No timing was recorded for this component; it is unavailable, not zero.</hx-p
		>
	{/if}
	{#each timings as benchmark, position (position)}
		<hx-h3>
			{benchmark.metric} on {benchmark.workload}{benchmark.target ? ` (${benchmark.target})` : ''}
		</hx-h3>
		{#if benchmark.incompatible}
			<hx-p class="hc-notice">
				Not comparable: these series were measured on different machines or under different
				conditions. They are shown side by side and are not joined into one trend.
			</hx-p>
		{/if}
		{#each benchmark.series as series, position (position)}
			<hx-p class="hc-muted"
				>Profile {series.profile}: {profile(series.profile)}. {series.method}</hx-p
			>
			<hx-div class="hc-table-wrap">
				<hx-table class="hc-table">
					<hx-thead
						><hx-tr><hx-th>Commit</hx-th><hx-th>Value ({series.unitOfMeasure})</hx-th></hx-tr
						></hx-thead
					>
					<hx-tbody>
						{#each series.points as point, position (position)}
							<hx-tr>
								<hx-td
									>{point.commit.slice(0, 7)}
									<hx-span class="hc-muted">{subject(point.commit)}</hx-span></hx-td
								>
								<hx-td>{point.value}</hx-td>
							</hx-tr>
						{/each}
					</hx-tbody>
				</hx-table>
			</hx-div>
		{/each}
	{/each}
</hx-section>
