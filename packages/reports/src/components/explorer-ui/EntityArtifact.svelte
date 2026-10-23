<script lang="ts">
	import type { BehaviorCell } from '../../utils/explorer-ui/entityBehavior';
	import { artifactText } from '../../utils/explorer-ui/explorerArtifact';
	import { mediaFile } from '../../utils/explorer-ui/harnessEvidence';
	import type { ExplorerArtifactBehavior } from '../../models/explorer-ui/ExplorerEvidence.types';
	import EntityCases from './entity-cases/EntityCases.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		cell,
		label,
		mediaBase,
		lost = false,
		unit
	}: {
		/** One recorded result with what it holds, once the host read and checked it. */
		cell: BehaviorCell;
		/** What the result is, as its group and its link are named. */
		label: string;
		mediaBase: string;
		/** True when reading the results failed, so nothing more is coming for this one. */
		lost?: boolean;
		/** The function this result is shown for: only its own calls are rows. */
		unit?: string;
	} = $props();
	// What a person reads at once; the whole of a larger result is the recorded file.
	const most = 12_000;
	const shown = (value: unknown) => {
		const text = artifactText(value);
		return text.length > most
			? `${text.slice(0, most)}\n… (shortened; open the recorded file)`
			: text;
	};
	let run = $derived(cell.read?.verified ? cell.read.behavior : null);
	/** Whether the recorded text was asked for: it is drawn only then, and never twice at once. */
	let asked = $state(false);
	const facts = (run: ExplorerArtifactBehavior) =>
		[
			['Scenario', run.scenario],
			['Environment', run.environment],
			['Test data', run.fixture]
		].filter(([, value]) => value);
</script>

{#snippet recorded(run: ExplorerArtifactBehavior)}
	{#if facts(run).length}
		<dl class="ex-rows">
			{#each facts(run) as [name, value] (name)}
				<div>
					<dt>{name}</dt>
					<dd>{value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
	{#if run.steps.length}
		<h4>Steps</h4>
		<ol class="ex-steps">
			{#each run.steps as step, position (position)}<li>{shown(step)}</li>{/each}
		</ol>
	{/if}
	{#if run.assertions.length}
		<h4>Assertions</h4>
		<ul class="ex-checks">
			{#each run.assertions as item, position (position)}
				<li>
					{#if item.passed === null}
						<span class="ex-soft">Not stated</span>
					{:else}
						<HarnessVerdict passed={item.passed} label={item.passed ? 'Held' : 'Failed'} />
					{/if}
					<span>{item.name}</span>
					{#if item.detail}<pre>{shown(item.detail)}</pre>{/if}
				</li>
			{/each}
		</ul>
	{/if}
	{#if run.trace.length}
		<details>
			<summary>Trace · {run.trace.length} {run.trace.length === 1 ? 'entry' : 'entries'}</summary>
			<pre>{shown(run.trace)}</pre>
		</details>
	{/if}
	{#if Object.keys(run.other).length}
		<details>
			<summary>Also recorded</summary>
			<pre>{shown(run.other)}</pre>
		</details>
	{/if}
{/snippet}

{#if !cell.capture}
	<p class="ex-soft" data-harness-component="harness-entity-artifact">Not recorded</p>
{:else if cell.capture.media === null}
	<p class="ex-gap" data-harness-component="harness-entity-artifact">
		<HarnessVerdict passed={false} label="Not stored" />
		<span>{cell.capture.gap ?? 'Its bytes are not in this history.'}</span>
	</p>
{:else}
	<div
		class="ex-artifact"
		role="group"
		aria-label={label}
		data-harness-component="harness-entity-artifact"
	>
		{#if cell.read === undefined && !lost}
			<p class="ex-soft" role="status">Reading what it holds…</p>
		{:else if !cell.read || !cell.read.verified}
			<p class="ex-gap">
				<HarnessVerdict passed={false} label="Not verified" />
				<span>{cell.read?.problem ?? 'It could not be read and checked against its hash.'}</span>
			</p>
		{:else}
			<!-- A result is shown by its rows; what else was recorded stays behind a disclosure. -->
			<EntityCases document={cell.read.document} {unit} callable={unit !== undefined} />
			<details>
				<summary>Assertions and recorded result</summary>
				{#if run}{@render recorded(run)}{/if}
				{#if cell.read.document === null}
					<pre>{shown(cell.read.text)}</pre>
				{:else}
					<!-- All that was read and checked, as it was recorded: a field no row shows is here. -->
					<details bind:open={asked}>
						<summary>Recorded JSON</summary>
						{#if asked}<pre>{shown(cell.read.text)}</pre>{/if}
					</details>
				{/if}
			</details>
		{/if}
		<a class="ex-link" href={mediaBase + mediaFile(cell.capture)} target="_blank" rel="noreferrer"
			>Open the recorded {label}</a
		>
	</div>
{/if}
