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
	<section
		class="regression-proof"
		aria-label="Regression proof"
		data-harness-component="regression-proof"
	>
		<header>
			<h2>Regression proof</h2>
			<p>Recorded tests before and after a fix.</p>
		</header>
		{#each shown as item, index (index)}
			<article>
				<h3>{item.loop.replaceAll('-', ' ')}</h3>
				{#if item.gap}<p role="alert">{item.gap}</p>{:else if item.red}
					<p><strong>{item.green ? 'Regression fixed' : 'Failing at this commit'}</strong></p>
					<p class="proof-context">
						{item.green
							? 'The failure below is historical. The same tests pass at the fix commit.'
							: 'This records the bug before repair. No passing fix is recorded here.'}
					</p>
					<div class="proof-steps">
						<div class="proof-step failed">
							<div class="step-heading">
								<span>Before fix · failed as expected</span><HarnessVerdict
									passed={false}
									label="Historical test result: failed before the fix"
								/>
							</div>
							<p class="assertion">{item.red.assertion}</p>
							<a
								href={href(item.red.commit)}
								aria-label="View failing test commit"
								onclick={(event) => open(event, item.red!.commit)}
								><code>{item.red.commit.slice(0, 7)}</code><span>View before-fix commit →</span></a
							>
						</div>
						<div class="proof-step" class:passed={Boolean(item.green)}>
							<div class="step-heading">
								<span>{item.green ? 'After fix · passed' : 'After fix · pending'}</span
								>{#if item.green}<HarnessVerdict
										passed={true}
										label="The same regression tests passed at the fix commit"
									/>{/if}
							</div>
							{#if item.green}<p class="assertion">Same tests and command</p>
								<a
									href={href(item.green.commit)}
									aria-label="View fix commit"
									onclick={(event) => open(event, item.green!.commit)}
									><code>{item.green.commit.slice(0, 7)}</code><span>View fix commit →</span></a
								>{:else}<p>Awaiting a passing fix commit.</p>{/if}
						</div>
					</div>
					<details ontoggle={(event) => (expanded[index] = event.currentTarget.open)}>
						<summary>Test command and recorded output</summary>
						{#if expanded[index]}<code class="command">{item.red.command}</code>
							<div class="proof-steps">
								<div>
									<h4>Before fix · {item.red.commit.slice(0, 7)}</h4>
									<pre>{item.red.output}</pre>
								</div>
								{#if item.green}<div>
										<h4>After fix · {item.green.commit.slice(0, 7)}</h4>
										<pre>{item.green.output}</pre>
									</div>{/if}
							</div>
						{/if}
					</details>
				{/if}
			</article>
		{/each}
		<p class="footnote">
			These results prove the regression. Full verification and budgets are checked separately.
		</p>
	</section>
{/if}

<style>
	.regression-proof {
		margin: var(--hx-space-20) 0;
		padding: var(--hx-space-22);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
		min-width: 0;
	}
	.proof-context,
	header p,
	.footnote {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-sm);
	}
	h2 {
		margin: 0 0 var(--hx-space-6);
		font-size: var(--hx-type-size-xl);
	}
	h3 {
		margin: var(--hx-space-20) 0 var(--hx-space-12);
		text-transform: capitalize;
		font-size: var(--hx-type-size-sm);
		color: var(--hx-color-text-supporting);
	}
	.proof-steps {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--hx-space-16);
	}
	.proof-step {
		padding: var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		min-width: 0;
	}
	.failed {
		border-top: var(--hx-border-heavy) solid var(--hx-color-error);
	}
	.passed {
		border-top: var(--hx-border-heavy) solid var(--hx-color-success);
	}
	.step-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: var(--hx-style-weight-semibold);
	}
	.assertion {
		margin: var(--hx-space-12) 0 var(--hx-space-22);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
	}
	a {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--hx-space-10);
		color: var(--hx-color-info);
		font-size: var(--hx-type-size-compact);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	a code {
		padding: var(--hx-space-4) var(--hx-space-6);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-xsmall);
	}
	details {
		margin-top: var(--hx-space-16);
	}
	summary {
		cursor: pointer;
		font-size: var(--hx-type-size-sm);
		color: var(--hx-color-text-supporting);
	}
	.command {
		display: block;
		padding: var(--hx-space-12) 0;
		overflow-wrap: anywhere;
	}
	pre {
		max-height: 260px;
		padding: var(--hx-space-12);
		overflow: auto;
		background: var(--hx-color-background);
		font-size: var(--hx-type-size-xs);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.footnote {
		margin: var(--hx-space-18) 0 0;
	}
	.proof-context {
		margin: 0 0 var(--hx-space-16);
	}
	@media (max-width: 700px) {
		.proof-steps {
			grid-template-columns: minmax(0, 1fr);
		}
		.regression-proof {
			padding: var(--hx-space-16);
		}
	}
</style>
