<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
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
		<hx-dl class="ex-rows">
			{#each facts(run) as [name, value] (name)}
				<hx-div>
					<hx-dt>{name}</hx-dt>
					<hx-dd>{value}</hx-dd>
				</hx-div>
			{/each}
		</hx-dl>
	{/if}
	{#if run.steps.length}
		<hx-h4>Steps</hx-h4>
		<hx-ol class="ex-steps">
			{#each run.steps as step, position (position)}<hx-li>{shown(step)}</hx-li>{/each}
		</hx-ol>
	{/if}
	{#if run.assertions.length}
		<hx-h4>Assertions</hx-h4>
		<hx-ul class="ex-checks">
			{#each run.assertions as item, position (position)}
				<hx-li>
					{#if item.passed === null}
						<hx-span class="ex-soft">Not stated</hx-span>
					{:else}
						<HarnessVerdict passed={item.passed} label={item.passed ? 'Held' : 'Failed'} />
					{/if}
					<hx-span>{item.name}</hx-span>
					{#if item.detail}<hx-pre>{shown(item.detail)}</hx-pre>{/if}
				</hx-li>
			{/each}
		</hx-ul>
	{/if}
	{#if run.trace.length}
		<hx-details>
			<hx-summary
				>Trace · {run.trace.length} {run.trace.length === 1 ? 'entry' : 'entries'}</hx-summary
			>
			<hx-pre>{shown(run.trace)}</hx-pre>
		</hx-details>
	{/if}
	{#if Object.keys(run.other).length}
		<hx-details>
			<hx-summary>Also recorded</hx-summary>
			<hx-pre>{shown(run.other)}</hx-pre>
		</hx-details>
	{/if}
{/snippet}

{#if !cell.capture}
	<hx-p class="ex-soft" data-harness-component="harness-entity-artifact">Not recorded</hx-p>
{:else if cell.capture.media === null}
	<hx-p class="ex-gap" data-harness-component="harness-entity-artifact">
		<HarnessVerdict passed={false} label="Not stored" />
		<hx-span>{cell.capture.gap ?? 'Its bytes are not in this history.'}</hx-span>
	</hx-p>
{:else}
	<hx-div
		class="ex-artifact"
		role="group"
		aria-label={label}
		data-harness-component="harness-entity-artifact"
	>
		{#if cell.read === undefined && !lost}
			<hx-p class="ex-soft" role="status">Reading what it holds…</hx-p>
		{:else if !cell.read || !cell.read.verified}
			<hx-p class="ex-gap">
				<HarnessVerdict passed={false} label="Not verified" />
				<hx-span
					>{cell.read?.problem ?? 'It could not be read and checked against its hash.'}</hx-span
				>
			</hx-p>
		{:else}
			<!-- A result is shown by its rows; what else was recorded stays behind a disclosure. -->
			<EntityCases document={cell.read.document} {unit} callable={unit !== undefined} />
			<hx-details>
				<hx-summary>Assertions and recorded result</hx-summary>
				{#if run}{@render recorded(run)}{/if}
				{#if cell.read.document === null}
					<hx-pre>{shown(cell.read.text)}</hx-pre>
				{:else}
					<!-- All that was read and checked, as it was recorded: a field no row shows is here. -->
					<hx-details bind:open={asked}>
						<hx-summary>Recorded JSON</hx-summary>
						{#if asked}<hx-pre>{shown(cell.read.text)}</hx-pre>{/if}
					</hx-details>
				{/if}
			</hx-details>
		{/if}
		<hx-a
			class="ex-link"
			href={mediaBase + mediaFile(cell.capture)}
			target="_blank"
			rel="noreferrer">Open the recorded {label}</hx-a
		>
	</hx-div>
{/if}
