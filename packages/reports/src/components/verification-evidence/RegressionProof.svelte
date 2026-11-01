<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import ComparePanes from '../shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '../../helpers/verification-evidence/comparisonPanes';
	import { shortCommit } from '../../helpers/strings/shortCommit';

	import type { RegressionView } from '../../../../../src/core/regressionTypes';
	import Status from '../shared-primitives/status/Status.svelte';
	let {
		items = [],
		unit,
		href,
		follow
	}: {
		items?: RegressionView[];
		unit: string;
		href: (commit: string) => string;
		follow?: (commit: string) => void;
	} = $props();
	const shown = $derived(items.filter((item) => !item.units.length || item.units.includes(unit)));
	let expanded = $state<Record<number, boolean>>({});
	function open(event: MouseEvent, commit: string) {
		if (
			!follow ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		)
			return;
		event.preventDefault();
		follow(commit);
	}
</script>

<hx-section
	class="regression-proof"
	aria-label="Regression proof"
	data-harness-component="regression-proof"
>
	<hx-header>
		<hx-h2>Regression proof</hx-h2>
		<hx-p>Recorded regression tests and evidence.</hx-p>
	</hx-header>
	{#if shown.length}
		{#each shown as item, index (index)}
			<hx-article>
				<hx-h3>{item.loop.replaceAll('-', ' ')}</hx-h3>
				{#if item.gap}<hx-p role="alert">{item.gap}</hx-p>{:else if item.red}
					<hx-p
						><hx-strong>{item.green ? 'Regression fixed' : 'Failing at this commit'}</hx-strong
						></hx-p
					>
					<hx-p class="proof-context">
						{item.green
							? 'The failure below is historical. The same tests pass at the fix commit.'
							: 'This records the bug before repair. No passing fix is recorded here.'}
					</hx-p>

					{@const panes = comparisonPanes(
						{ value: item.red, commit: item.red.commit },
						{ value: item.green, commit: item.green?.commit, gap: 'Awaiting a passing fix commit.' }
					)}
					<ComparePanes {panes} className="proof-steps" framed={false}>
						{#snippet children(pane)}
							<hx-div
								class="proof-step"
								class:failed={pane.side === 'before'}
								class:passed={pane.side === 'after' && Boolean(pane.value)}
							>
								<hx-div class="step-heading">
									<hx-span
										>{pane.heading} · {pane.side === 'before'
											? 'failed as expected'
											: pane.value
												? 'passed'
												: 'pending'}</hx-span
									>
									{#if pane.value}<Status
											passed={pane.side === 'after'}
											label={pane.side === 'before'
												? 'Historical test result: failed before the fix'
												: 'The same regression tests passed at the fix commit'}
										/>{/if}
								</hx-div>
								{#if pane.value}<hx-p class="assertion"
										>{pane.side === 'before'
											? pane.value.assertion
											: 'Same tests and command'}</hx-p
									>
									<hx-a
										href={href(pane.commit)}
										aria-label={pane.side === 'before'
											? 'View failing test commit'
											: 'View fix commit'}
										onclick={(event) => open(event, pane.commit)}
										><hx-code>{shortCommit(pane.commit)}</hx-code><hx-span
											>{pane.side === 'before'
												? 'View before-fix commit →'
												: 'View fix commit →'}</hx-span
										></hx-a
									>
								{:else}<hx-p>{pane.gap}</hx-p>{/if}
							</hx-div>
						{/snippet}
					</ComparePanes>
					<hx-details ontoggle={(event) => (expanded[index] = event.currentTarget.open)}>
						<hx-summary>Test command and recorded output</hx-summary>
						{#if expanded[index]}<hx-code class="command">{item.red.command}</hx-code>

							<ComparePanes {panes} className="proof-steps" framed={false}>
								{#snippet children(pane)}
									{#if pane.value}<hx-div
											><hx-h4>{pane.heading}</hx-h4><hx-pre>{pane.value.output}</hx-pre></hx-div
										>{/if}
								{/snippet}
							</ComparePanes>
						{/if}
					</hx-details>
				{:else}<hx-p>No failing-test checkpoint is recorded.</hx-p>{/if}
			</hx-article>
		{/each}
		<hx-p class="footnote">
			{#if shown.every((item) => !item.gap && item.red && item.green)}
				These results prove the regression.
			{/if}
			Full verification and budgets are checked separately.
		</hx-p>
	{:else}
		<hx-p>No regression proof is available for this unit.</hx-p>
	{/if}
</hx-section>

<style>
	@import './regression-proof/regressionProof.css';
</style>
