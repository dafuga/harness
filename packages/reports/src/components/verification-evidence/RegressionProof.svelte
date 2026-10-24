<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { RegressionView } from '../../../../../src/core/regressionTypes';
	import HarnessVerdict from '../explorer-ui/harness-verdict/HarnessVerdict.svelte';
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
{#if shown.length}
	<hx-section
		class="regression-proof"
		aria-label="Regression proof"
		data-harness-component="regression-proof"
	>
		<hx-header>
			<hx-h2>Regression proof</hx-h2>
			<hx-p>Recorded tests before and after a fix.</hx-p>
		</hx-header>
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
					<hx-div class="proof-steps">
						<hx-div class="proof-step failed">
							<hx-div class="step-heading">
								<hx-span>Before fix · failed as expected</hx-span><HarnessVerdict
									passed={false}
									label="Historical test result: failed before the fix"
								/>
							</hx-div>
							<hx-p class="assertion">{item.red.assertion}</hx-p>
							<hx-a
								href={href(item.red.commit)}
								aria-label="View failing test commit"
								onclick={(event) => open(event, item.red!.commit)}
								><hx-code>{item.red.commit.slice(0, 7)}</hx-code><hx-span
									>View before-fix commit →</hx-span
								></hx-a
							>
						</hx-div>
						<hx-div class="proof-step" class:passed={Boolean(item.green)}>
							<hx-div class="step-heading">
								<hx-span>{item.green ? 'After fix · passed' : 'After fix · pending'}</hx-span
								>{#if item.green}<HarnessVerdict
										passed={true}
										label="The same regression tests passed at the fix commit"
									/>{/if}
							</hx-div>
							{#if item.green}<hx-p class="assertion">Same tests and command</hx-p>
								<hx-a
									href={href(item.green.commit)}
									aria-label="View fix commit"
									onclick={(event) => open(event, item.green!.commit)}
									><hx-code>{item.green.commit.slice(0, 7)}</hx-code><hx-span
										>View fix commit →</hx-span
									></hx-a
								>{:else}<hx-p>Awaiting a passing fix commit.</hx-p>{/if}
						</hx-div>
					</hx-div>
					<hx-details ontoggle={(event) => (expanded[index] = event.currentTarget.open)}>
						<hx-summary>Test command and recorded output</hx-summary>
						{#if expanded[index]}<hx-code class="command">{item.red.command}</hx-code>
							<hx-div class="proof-steps">
								<hx-div>
									<hx-h4>Before fix · {item.red.commit.slice(0, 7)}</hx-h4>
									<hx-pre>{item.red.output}</hx-pre>
								</hx-div>
								{#if item.green}<hx-div>
										<hx-h4>After fix · {item.green.commit.slice(0, 7)}</hx-h4>
										<hx-pre>{item.green.output}</hx-pre>
									</hx-div>{/if}
							</hx-div>
						{/if}
					</hx-details>
				{/if}
			</hx-article>
		{/each}
		<hx-p class="footnote">
			These results prove the regression. Full verification and budgets are checked separately.
		</hx-p>
	</hx-section>
{/if}
<style>
	@import "./regression-proof/regressionProof.css";
</style>
