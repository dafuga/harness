<script lang="ts">
	import type { BehaviorCell } from '../../../reports/src/utils/entityBehavior';
	import { artifactText } from '../../../reports/src/utils/explorerArtifact';
	import StatusIcon from './StatusIcon.svelte';
	let {
		cell,
		label,
		lost,
		refusal
	}: {
		/** One recorded result with what it holds, once it was read and checked. */
		cell: BehaviorCell;
		label: string;
		/** True when reading the results failed, so nothing more is coming for this one. */
		lost: boolean;
		/** What the backend said when it gave no bytes for this result. */
		refusal?: string;
	} = $props();
	/** What a person reads at once; a longer result is shortened and says so. */
	const most = 12_000;
	const text = (value: unknown) => {
		const whole = artifactText(value);
		return whole.length > most ? `${whole.slice(0, most)}\n… (shortened)` : whole;
	};
	const run = $derived(cell.read?.verified ? cell.read.behavior : null);
	const facts = $derived(
		[
			['Scenario', run?.scenario],
			['Environment', run?.environment],
			['Test data', run?.fixture]
		].filter(([, value]) => value)
	);
	const unverified = 'It could not be read and checked against its hash.';
</script>

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
			</p>{:else if run}{#if facts.length}<dl class="runtime-facts">
					{#each facts as [name, value] (name)}<dt>{name}</dt>
						<dd>{value}</dd>{/each}
				</dl>{/if}{#if run.steps.length}<h5>Steps</h5>
				<ol>
					{#each run.steps as step, position (position)}<li>{text(step)}</li>{/each}
				</ol>{/if}{#if run.input !== undefined}<h5>Input</h5>
				<pre>{text(run.input)}</pre>{/if}{#if run.output !== undefined}<h5>Actual output</h5>
				<pre>{text(run.output)}</pre>{/if}{#if run.assertions.length}<h5>Assertions</h5>
				<ul class="runtime-checks">
					{#each run.assertions as item, position (position)}<li>
							{#if item.passed === null}<span class="muted">Not stated</span>{:else}<StatusIcon
									status={item.passed ? 'verified' : 'failed'}
									reason={item.passed ? 'Held' : 'Failed'}
								/>{/if}<span>{item.name}</span>{#if item.detail}<pre>{text(item.detail)}</pre>{/if}
						</li>{/each}
				</ul>{/if}{#if run.trace.length}<details>
					<summary
						>Trace · {run.trace.length} {run.trace.length === 1 ? 'entry' : 'entries'}</summary
					>
					<pre>{text(run.trace)}</pre>
				</details>{/if}{#if Object.keys(run.other).length}<details>
					<summary>Also recorded</summary>
					<pre>{text(run.other)}</pre>
				</details>{/if}{:else}<pre>{text(cell.read.text)}</pre>{/if}
	</div>{/if}
