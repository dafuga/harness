<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import EntityCases from '../../../../reports/src/components/explorer-ui/entity-cases/EntityCases.svelte';
	import type { ExplorerArtifactBehavior } from '../../../../reports/src/models/ExplorerEvidence.types';
	import type { BehaviorCell } from '../../../../reports/src/utils/entityBehavior';
	import { artifactText } from '../../../../reports/src/utils/explorerArtifact';
	import StatusIcon from '../shared-primitives/StatusIcon.svelte';
	let {
		cell,
		label,
		lost,
		refusal,
		unit
	}: {
		/** One recorded result with what it holds, once it was read and checked. */
		cell: BehaviorCell;
		label: string;
		/** True when reading the results failed, so nothing more is coming for this one. */
		lost: boolean;
		/** What the backend said when it gave no bytes for this result. */
		refusal?: string;
		/** The function this result is shown for: only its own calls are rows. */
		unit?: string;
	} = $props();
	/** What a person reads at once; a longer result is shortened and says so. */
	const most = 12_000;
	const text = (value: unknown) => {
		const whole = artifactText(value);
		return whole.length > most ? `${whole.slice(0, most)}\n… (shortened)` : whole;
	};
	const run = $derived(cell.read?.verified ? cell.read.behavior : null);
	/** Whether the recorded text was asked for: it is drawn only then, and never twice at once. */
	let asked = $state(false);
	const facts = (stated: ExplorerArtifactBehavior) =>
		[
			['Scenario', stated.scenario],
			['Environment', stated.environment],
			['Test data', stated.fixture]
		].filter(([, value]) => value);
	const unverified = 'It could not be read and checked against its hash.';
</script>

{#snippet recorded(stated: ExplorerArtifactBehavior)}
	{#if facts(stated).length}<hx-dl class="runtime-facts">
			{#each facts(stated) as [name, value] (name)}<hx-dt>{name}</hx-dt>
				<hx-dd>{value}</hx-dd>{/each}
		</hx-dl>{/if}
	{#if stated.steps.length}<hx-h5>Steps</hx-h5>
		<hx-ol>
			{#each stated.steps as step, position (position)}<hx-li>{text(step)}</hx-li>{/each}
		</hx-ol>{/if}
	{#if stated.assertions.length}<hx-h5>Assertions</hx-h5>
		<hx-ul class="runtime-checks">
			{#each stated.assertions as item, position (position)}<hx-li>
					{#if item.passed === null}<hx-span class="muted">Not stated</hx-span>{:else}<StatusIcon
							status={item.passed ? 'verified' : 'failed'}
							reason={item.passed ? 'Held' : 'Failed'}
						/>{/if}<hx-span>{item.name}</hx-span>{#if item.detail}<hx-pre
							>{text(item.detail)}</hx-pre
						>{/if}
				</hx-li>{/each}
		</hx-ul>{/if}
	{#if stated.trace.length}<hx-details>
			<hx-summary
				>Trace · {stated.trace.length} {stated.trace.length === 1 ? 'entry' : 'entries'}</hx-summary
			>
			<hx-pre>{text(stated.trace)}</hx-pre>
		</hx-details>{/if}
	{#if Object.keys(stated.other).length}<hx-details>
			<hx-summary>Also recorded</hx-summary>
			<hx-pre>{text(stated.other)}</hx-pre>
		</hx-details>{/if}
{/snippet}

{#if !cell.capture}<hx-p class="muted">Not recorded</hx-p
	>{:else if cell.capture.media === null}<hx-p class="runtime-gap">
		<StatusIcon status="failed" reason="Not stored" /><hx-span
			>{cell.capture.gap ?? 'Its bytes are not in this history.'}</hx-span
		>
	</hx-p>{:else}<hx-div class="runtime-artifact" role="group" aria-label={label}>
		{#if cell.read === undefined && !lost}<hx-p class="muted">Reading what it holds…</hx-p>
		{:else if !cell.read?.verified}<hx-p class="runtime-gap">
				<StatusIcon status="failed" reason="Not verified" /><hx-span
					>{refusal ?? cell.read?.problem ?? unverified}</hx-span
				>
			</hx-p>
		{:else}
			<!-- A result is shown by its rows; what else was recorded stays behind a disclosure. -->
			<EntityCases document={cell.read.document} {unit} callable={unit !== undefined} />
			<hx-details>
				<hx-summary>Assertions and recorded result</hx-summary>
				{#if run}{@render recorded(run)}{/if}
				{#if cell.read.document === null}<hx-pre>{text(cell.read.text)}</hx-pre>{:else}
					<!-- All that was read and checked, as it was recorded: a field no row shows is here. -->
					<hx-details bind:open={asked}>
						<hx-summary>Recorded JSON</hx-summary>
						{#if asked}<hx-pre>{text(cell.read.text)}</hx-pre>{/if}
					</hx-details>{/if}
			</hx-details>
		{/if}
	</hx-div>{/if}
