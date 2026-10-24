<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessRevision } from '../../../models/explorer-ui/Harness.types';
	import { comparisonChoices, harnessComparison } from './harnessComparison';
	import EvidenceGrid from '../../verification-evidence/evidence-grid/EvidenceGrid.svelte';
	import Select from '../../shared-primitives/Select.svelte';
	let {
		base,
		head,
		mediaBase
	}: { base: HarnessRevision | undefined; head: HarnessRevision; mediaBase: string } = $props();
	const preferred = (detail: HarnessRevision | undefined) =>
		detail?.records.find((item) => item.valid && item.status === 'passed') ?? detail?.records[0];
	let picked = $state({ base: '', head: '', scenario: '', state: '', viewport: '' });
	const record = (detail: HarnessRevision | undefined, id: string) =>
		detail?.records.find((item) => item.id === id) ?? preferred(detail) ?? null;
	let sides = $derived(
		base
			? {
					base: { detail: base, record: record(base, picked.base) },
					head: { detail: head, record: record(head, picked.head) }
				}
			: null
	);
	let choices = $derived(sides ? comparisonChoices(sides.base, sides.head) : []);
	let current = $derived(choices.find((item) => item.scenario === picked.scenario) ?? choices[0]);
	let compared = $derived(
		sides && current
			? harnessComparison(sides.base, sides.head, {
					scenario: current.scenario,
					state: current.states.includes(picked.state) ? picked.state : '',
					viewport: current.viewports.includes(picked.viewport) ? picked.viewport : ''
				})
			: null
	);
	const short = (commit: string) => commit.slice(0, 7);
	const named = (item: { id: string; status: string; profile: string }) =>
		`Record ${item.id.slice(0, 12)} · ${item.status} · profile ${item.profile}`;
</script>

{#snippet records(label: string, detail: HarnessRevision, side: 'base' | 'head')}
	{#if detail.records.length > 1}
		<hx-label
			>{label}
			<Select {label} bind:value={picked[side]}>
				{#each detail.records as item (item.id)}<hx-option value={item.id}>{named(item)}</hx-option
					>{/each}
			</Select>
		</hx-label>
	{/if}
{/snippet}

<hx-section class="hc-card" aria-label="Recorded states, before and after">
	<hx-h2>Recorded states, before and after</hx-h2>
	{#if !sides}
		<hx-p class="hc-muted">No base commit is selected.</hx-p>
	{:else}
		{#each [sides.base, sides.head] as side, position (position)}
			{#if !side.record}
				<hx-p class="hc-notice">
					Nothing was recorded for {short(side.detail.commit)}: it has no verification record. Its
					side of every state below is a gap, not a capture from another commit.
				</hx-p>
			{/if}
		{/each}
		{#if !current}
			<hx-p class="hc-muted">Neither commit has recorded screenshots or audio.</hx-p>
		{:else}
			<hx-div class="hc-controls">
				<hx-label
					>Scenario
					<Select label="Scenario" bind:value={picked.scenario}>
						{#each choices as item, position (position)}<hx-option value={item.scenario}
								>{item.scenario}</hx-option
							>{/each}
					</Select>
				</hx-label>
				<hx-label
					>State
					<Select label="State" bind:value={picked.state}>
						<hx-option value="">Every state</hx-option>
						{#each current.states as id (id)}<hx-option value={id}>{id}</hx-option>{/each}
					</Select>
				</hx-label>
				{#if current.viewports.length}
					<hx-label
						>Viewport
						<Select label="Viewport" bind:value={picked.viewport}>
							<hx-option value="">Every viewport</hx-option>
							{#each current.viewports as id (id)}<hx-option value={id}>{id}</hx-option>{/each}
						</Select>
					</hx-label>
				{/if}
				{@render records('Base record', sides.base.detail, 'base')}
				{@render records('Head record', sides.head.detail, 'head')}
			</hx-div>
			{#if compared}
				<hx-ul class="hc-plain" aria-label="Aligned states">
					{#each compared.aligned as row, position (position)}
						<hx-li>
							<hx-strong>{row.label}</hx-strong><hx-br /><hx-span class="hc-muted"
								>before: {row.before}</hx-span
							><hx-br /><hx-span class="hc-muted">after: {row.after}</hx-span>
						</hx-li>
					{/each}
				</hx-ul>
				{#key current.scenario + picked.base + picked.head + picked.state + picked.viewport}
					<EvidenceGrid items={compared.items} assetBase={mediaBase} idPrefix="compare-" />
				{/key}
			{/if}
		{/if}
	{/if}
</hx-section>
