<script lang="ts">
	import type { RegressionView } from '../../../../../src/core/regressionTypes';
	import HarnessVerdict from '../explorer-ui/harness/harness-verdict/HarnessVerdict.svelte';
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
		margin: 20px 0;
		padding: 22px;
		border: 1px solid var(--hx-line, #284759);
		border-radius: 12px;
		background: var(--hx-surface, #0a2230);
		min-width: 0;
	}
	.proof-context,
	header p,
	.footnote {
		color: var(--hx-muted, #9bb2c1);
		font-size: 0.875rem;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 1.2rem;
	}
	h3 {
		margin: 20px 0 12px;
		text-transform: capitalize;
		font-size: 0.9rem;
		color: var(--hx-soft, #cbd5e1);
	}
	.proof-steps {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}
	.proof-step {
		padding: 16px;
		border: 1px solid var(--hx-line, #284759);
		border-radius: 8px;
		min-width: 0;
	}
	.failed {
		border-top: 3px solid var(--hx-fail, #f2545b);
	}
	.passed {
		border-top: 3px solid var(--hx-pass, #34d399);
	}
	.step-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 600;
	}
	.assertion {
		margin: 12px 0 22px;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	a {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		color: var(--hx-accent, #ffd22e);
		font-size: 0.8rem;
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	a code {
		padding: 4px 6px;
		border: 1px solid var(--hx-line, #284759);
		border-radius: 4px;
	}
	details {
		margin-top: 16px;
	}
	summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--hx-soft, #cbd5e1);
	}
	.command {
		display: block;
		padding: 12px 0;
		overflow-wrap: anywhere;
	}
	pre {
		max-height: 260px;
		padding: 12px;
		overflow: auto;
		background: #061923;
		font-size: 0.75rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.footnote {
		margin: 18px 0 0;
	}
	.proof-context {
		margin: 0 0 16px;
	}
	@media (max-width: 700px) {
		.proof-steps {
			grid-template-columns: minmax(0, 1fr);
		}
		.regression-proof {
			padding: 16px;
		}
	}
</style>
