<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_nwynxsbstv -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import DetailList from '$shared/shared-primitives/DetailList.svelte';
	import EntityCases from '$shared/explorer-ui/entity-cases/EntityCases.svelte';
	import type { ExplorerArtifactBehavior } from '$reports/models/explorer-ui/ExplorerEvidence.types';
	import type { BehaviorCell } from '$reports/utils/explorer-ui/entityBehavior';
	import { artifactText } from '$reports/utils/explorerArtifact';
	import Status from '$shared/shared-primitives/status/Status.svelte';
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
	const showCases = $derived.by(() => {
		const document = cell.read?.document;
		if (!document || typeof document !== 'object') return false;
		if (!run?.steps.length && !run?.assertions.length) return true;
		return ['cases', 'output', 'outputs', 'response'].some((field) => field in document);
	});
	const stepText = (step: unknown) => {
		if (
			typeof step === 'object' &&
			step !== null &&
			'action' in step &&
			step.action === 'search' &&
			'text' in step &&
			typeof step.text === 'string'
		)
			return `Search for “${step.text}”`;
		return text(step);
	};
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
	{#if facts(stated).length}<DetailList
			rows={facts(stated)}
			rowKey={([name]) => String(name)}
			className="runtime-facts"
			grouped={false}
		>
			{#snippet label([name])}{name}{/snippet}
			{#snippet children([, value])}{value}{/snippet}
		</DetailList>{/if}
	{#if stated.steps.length}<hx-h5>Steps</hx-h5>
		<hx-ol>
			{#each stated.steps as step, position (position)}<hx-li>{stepText(step)}</hx-li>{/each}
		</hx-ol>{/if}
	{#if stated.assertions.length}<hx-h5>Assertions</hx-h5>
		<hx-ul class="runtime-checks">
			{#each stated.assertions as item, position (position)}<hx-li>
					{#if item.passed === null}<hx-span class="muted">Not stated</hx-span>{:else}<Status
							variant="icon"
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
	>{:else if cell.capture.media === null}<Notice
		as="p"
		className="runtime-gap runtime-artifact-runtime-gap"
	>
		<Status variant="icon" status="failed" reason="Not stored" /><hx-span
			>{cell.capture.gap ?? 'Its bytes are not in this history.'}</hx-span
		>
	</Notice>{:else}<hx-div class="runtime-artifact" role="group" aria-label={label}>
		{#if cell.read === undefined && !lost}<hx-p class="muted">Reading what it holds…</hx-p>
		{:else if !cell.read?.verified}<Notice
				as="p"
				className="runtime-gap runtime-artifact-runtime-gap"
			>
				<Status variant="icon" status="failed" reason="Not verified" /><hx-span
					>{refusal ?? cell.read?.problem ?? unverified}</hx-span
				>
			</Notice>
		{:else}
			<!-- A result is shown by its rows; what else was recorded stays behind a disclosure. -->
			{#if showCases}<EntityCases
					document={cell.read.document}
					{unit}
					callable={unit !== undefined}
				/>{/if}
			<hx-details>
				<hx-summary
					>{cell.capture.kind === 'output'
						? 'Recorded output details'
						: 'Assertions and recorded result'}</hx-summary
				>
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

<style>
	:global(.runtime-artifact-runtime-gap) {
		flex-wrap: nowrap;
	}
	:global(.runtime-artifact-runtime-gap > .verification-wrap) {
		flex: none;
	}
</style>
