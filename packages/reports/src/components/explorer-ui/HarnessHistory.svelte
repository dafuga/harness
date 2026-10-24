<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type {
		HarnessRevision,
		HarnessRevisionSummary
	} from '../../models/explorer-ui/Harness.types';
	import { harnessEvidence, mediaFile } from '../../utils/explorer-ui/harnessEvidence';
	import { captureProvenance, scenarioOrigin } from '../../utils/reports-media/captureProvenance';
	import EvidenceGrid from '../verification-evidence/evidence-grid/EvidenceGrid.svelte';
	import HarnessFailures from './harness-failures/HarnessFailures.svelte';
	let {
		summary,
		detail,
		mediaBase,
		exportHref,
		record: chosen = null,
		onrecord = () => {}
	}: {
		summary: HarnessRevisionSummary;
		detail: HarnessRevision;
		mediaBase: string;
		exportHref: string;
		/** The record the address names; without one the passing record is shown. */
		record?: string | null;
		onrecord?: (id: string) => void;
	} = $props();
	let record = $derived(
		detail.records.find((item) => item.id === chosen) ??
			detail.records.find((item) => item.valid && item.status === 'passed') ??
			detail.records[0] ??
			null
	);
	let evidence = $derived(record ? harnessEvidence(detail, record) : []);
	let other = $derived(
		(record?.scenarios ?? []).flatMap((scenario) =>
			scenario.states.flatMap((state) =>
				state.captures
					.filter((capture) => !['screenshot', 'audio'].includes(capture.kind))
					.map((capture) => ({
						scenario: scenario.id,
						state: state.id,
						capture,
						standing: record ? captureProvenance(record, scenario, capture).label : ''
					}))
			)
		)
	);
	const status = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
	const summaryOf = (id: string) => summary.records.find((item) => item.id === id);
</script>

<hx-section class="hc-card" aria-label="Recorded verification">
	<hx-h2>{summary.subject}</hx-h2>
	<hx-p class="hc-muted">
		{summary.commit} · {summary.author} · {summary.committedAt}
		{summary.retained ? ' · kept only by its archive ref' : ''}
	</hx-p>
	<hx-p class="hc-notice">
		{#if summary.coverage === 'unverified'}
			No verification record is attached to this commit. Nothing below was tested for it, and
			nothing from another commit is shown in its place.
		{:else if summary.coverage === 'verified'}
			A passing verification record proves this commit.
		{:else if summary.coverage === 'failed'}
			This commit was verified and did not pass.
		{:else}
			Records are attached to this commit, but none of them could be validated.
		{/if}
	</hx-p>
	{#if summary.coverage !== 'unverified'}
		{#each summary.gaps as gap, position (position)}<hx-p class="hc-muted">{gap}</hx-p>{/each}
	{/if}
	<hx-ul class="hc-records" aria-label="Verification records">
		{#each detail.records as item (item.id)}
			<hx-li class:current={item.id === record?.id}>
				<hx-button type="button" class="hc-chip" onclick={() => onrecord(item.id)}
					>Record {item.id.slice(0, 12)}</hx-button
				>
				<hx-span class="badge {item.status}"
					><hx-span aria-hidden="true">●</hx-span> {status(item.status)}</hx-span
				>
				<hx-span class="hc-muted"
					>profile {item.profile} · {item.finishedAt}{item.valid
						? ''
						: ' · could not be validated'}</hx-span
				>
				{#if item.failures.length || summaryOf(item.id)?.problems.length}
					<HarnessFailures
						record={item.id.slice(0, 12)}
						failures={item.failures}
						problems={summaryOf(item.id)?.problems ?? []}
					/>
				{/if}
			</hx-li>
		{/each}
	</hx-ul>
	{#if record}
		<hx-h3>Scenarios of record {record.id.slice(0, 12)}</hx-h3>
		<hx-ul class="hc-plain" aria-label="Scenarios">
			{#each record.scenarios as scenario (scenario.id)}
				<hx-li>
					<hx-strong>{scenario.id}</hx-strong>
					<hx-span class="hc-muted">{scenario.status} · {scenarioOrigin(scenario)}</hx-span>
					{#each scenario.states.filter((state) => state.coverage !== 'required') as state, position (position)}
						<hx-br /><hx-span class="hc-muted"
							>{state.id} is {state.coverage}: {state.reason}</hx-span
						>
					{/each}
				</hx-li>
			{/each}
		</hx-ul>
		{#if other.length}
			<hx-h3>Other recorded evidence</hx-h3>
			<hx-ul class="hc-plain">
				{#each other as item, position (position)}
					<hx-li>
						{item.scenario} · {item.state} · {item.capture.kind} · {item.standing}
						{#if item.capture.media}
							<hx-a
								class="hc-link"
								href={mediaBase + mediaFile(item.capture)}
								target="_blank"
								rel="noreferrer">open</hx-a
							>
						{:else}<hx-span class="hc-muted">{item.capture.gap}</hx-span>{/if}
					</hx-li>
				{/each}
			</hx-ul>
		{/if}
		{#if exportHref}
			<hx-p>
				<hx-a class="hc-link" href={exportHref + '?record=' + record.id}
					>Download this record as a portable report</hx-a
				>
			</hx-p>
		{/if}
	{/if}
</hx-section>
{#if record && evidence.length}
	{#key record.id}<EvidenceGrid items={evidence} assetBase={mediaBase} />{/key}
{/if}
