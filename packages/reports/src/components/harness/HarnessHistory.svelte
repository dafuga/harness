<script lang="ts">
	import type { HarnessRevision, HarnessRevisionSummary } from '../../models/Harness.types';
	import { harnessEvidence, mediaFile } from '../../utils/harnessEvidence';
	import { captureProvenance, scenarioOrigin } from '../../utils/captureProvenance';
	import EvidenceGrid from '../EvidenceGrid.svelte';
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

<section class="hc-card" aria-label="Recorded verification">
	<h2>{summary.subject}</h2>
	<p class="hc-muted">
		{summary.commit} · {summary.author} · {summary.committedAt}
		{summary.retained ? ' · kept only by its archive ref' : ''}
	</p>
	<p class="hc-notice">
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
	</p>
	{#if summary.coverage !== 'unverified'}
		{#each summary.gaps as gap, position (position)}<p class="hc-muted">{gap}</p>{/each}
	{/if}
	<ul class="hc-records" aria-label="Verification records">
		{#each detail.records as item (item.id)}
			<li class:current={item.id === record?.id}>
				<button type="button" class="hc-chip" onclick={() => onrecord(item.id)}
					>Record {item.id.slice(0, 12)}</button
				>
				<span class="badge {item.status}"
					><span aria-hidden="true">●</span> {status(item.status)}</span
				>
				<span class="hc-muted"
					>profile {item.profile} · {item.finishedAt}{item.valid
						? ''
						: ' · could not be validated'}</span
				>
				{#if item.failures.length || summaryOf(item.id)?.problems.length}
					<div class="hc-failures">
						{#each item.failures as failure, position (position)}<p>{failure}</p>{/each}
						{#each summaryOf(item.id)?.problems ?? [] as problem, position (position)}<p>
								{problem}
							</p>{/each}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	{#if record}
		<h3>Scenarios of record {record.id.slice(0, 12)}</h3>
		<ul class="hc-plain" aria-label="Scenarios">
			{#each record.scenarios as scenario (scenario.id)}
				<li>
					<strong>{scenario.id}</strong>
					<span class="hc-muted">{scenario.status} · {scenarioOrigin(scenario)}</span>
					{#each scenario.states.filter((state) => state.coverage !== 'required') as state, position (position)}
						<br /><span class="hc-muted">{state.id} is {state.coverage}: {state.reason}</span>
					{/each}
				</li>
			{/each}
		</ul>
		{#if other.length}
			<h3>Other recorded evidence</h3>
			<ul class="hc-plain">
				{#each other as item, position (position)}
					<li>
						{item.scenario} · {item.state} · {item.capture.kind} · {item.standing}
						{#if item.capture.media}
							<a
								class="hc-link"
								href={mediaBase + mediaFile(item.capture)}
								target="_blank"
								rel="noreferrer">open</a
							>
						{:else}<span class="hc-muted">{item.capture.gap}</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if exportHref}
			<p>
				<a class="hc-link" href={exportHref + '?record=' + record.id}
					>Download this record as a portable report</a
				>
			</p>
		{/if}
	{/if}
</section>
{#if record && evidence.length}
	{#key record.id}<EvidenceGrid items={evidence} assetBase={mediaBase} />{/key}
{/if}
