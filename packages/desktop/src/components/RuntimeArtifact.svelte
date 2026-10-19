<script lang="ts">
	import EntityCases from '../../../reports/src/components/EntityCases.svelte';
	import type { ExplorerArtifactBehavior } from '../../../reports/src/models/ExplorerEvidence.types';
	import type { BehaviorCell } from '../../../reports/src/utils/entityBehavior';
	import { artifactText } from '../../../reports/src/utils/explorerArtifact';
	import StatusIcon from './StatusIcon.svelte';
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
	{#if facts(stated).length}<dl class="runtime-facts">
			{#each facts(stated) as [name, value] (name)}<dt>{name}</dt>
				<dd>{value}</dd>{/each}
		</dl>{/if}
	{#if stated.steps.length}<h5>Steps</h5>
		<ol>
			{#each stated.steps as step, position (position)}<li>{text(step)}</li>{/each}
		</ol>{/if}
	{#if stated.assertions.length}<h5>Assertions</h5>
		<ul class="runtime-checks">
			{#each stated.assertions as item, position (position)}<li>
					{#if item.passed === null}<span class="muted">Not stated</span>{:else}<StatusIcon
							status={item.passed ? 'verified' : 'failed'}
							reason={item.passed ? 'Held' : 'Failed'}
						/>{/if}<span>{item.name}</span>{#if item.detail}<pre>{text(item.detail)}</pre>{/if}
				</li>{/each}
		</ul>{/if}
	{#if stated.trace.length}<details>
			<summary
				>Trace · {stated.trace.length} {stated.trace.length === 1 ? 'entry' : 'entries'}</summary
			>
			<pre>{text(stated.trace)}</pre>
		</details>{/if}
	{#if Object.keys(stated.other).length}<details>
			<summary>Also recorded</summary>
			<pre>{text(stated.other)}</pre>
		</details>{/if}
{/snippet}

{#if !cell.capture}<p class="muted">Not recorded</p>{:else if cell.capture.media === null}<p
		class="runtime-gap"
	>
		<StatusIcon status="failed" reason="Not stored" /><span
			>{cell.capture.gap ?? 'Its bytes are not in this history.'}</span
		>
	</p>{:else}<div class="runtime-artifact" role="group" aria-label={label}>
		{#if cell.read === undefined && !lost}<p class="muted">Reading what it holds…</p>
		{:else if !cell.read?.verified}<p class="runtime-gap">
				<StatusIcon status="failed" reason="Not verified" /><span
					>{refusal ?? cell.read?.problem ?? unverified}</span
				>
			</p>
		{:else}
			<!-- A result is shown by its rows; what else was recorded stays behind a disclosure. -->
			<EntityCases document={cell.read.document} {unit} callable={unit !== undefined} />
			<details>
				<summary>Assertions and recorded result</summary>
				{#if run}{@render recorded(run)}{/if}
				{#if cell.read.document === null}<pre>{text(cell.read.text)}</pre>{:else}
					<!-- All that was read and checked, as it was recorded: a field no row shows is here. -->
					<details bind:open={asked}>
						<summary>Recorded JSON</summary>
						{#if asked}<pre>{text(cell.read.text)}</pre>{/if}
					</details>{/if}
			</details>
		{/if}
	</div>{/if}
