<script lang="ts">
	import type { BehaviorCell } from '../../utils/entityBehavior';
	import { artifactText } from '../../utils/explorerArtifact';
	import { mediaFile } from '../../utils/harnessEvidence';
	import HarnessVerdict from './HarnessVerdict.svelte';
	let {
		cell,
		label,
		mediaBase,
		lost = false
	}: {
		/** One recorded result with what it holds, once the host read and checked it. */
		cell: BehaviorCell;
		/** What the result is, as its group and its link are named. */
		label: string;
		mediaBase: string;
		/** True when reading the results failed, so nothing more is coming for this one. */
		lost?: boolean;
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
	let facts = $derived(
		run
			? [
					['Scenario', run.scenario],
					['Environment', run.environment],
					['Test data', run.fixture]
				].filter(([, value]) => value)
			: []
	);
</script>

{#if !cell.capture}
	<p class="ex-soft">Not recorded</p>
{:else if cell.capture.media === null}
	<p class="ex-gap">
		<HarnessVerdict passed={false} label="Not stored" />
		<span>{cell.capture.gap ?? 'Its bytes are not in this history.'}</span>
	</p>
{:else}
	<div class="ex-artifact" role="group" aria-label={label}>
		{#if cell.read === undefined && !lost}
			<p class="ex-soft" role="status">Reading what it holds…</p>
		{:else if !cell.read || !cell.read.verified}
			<p class="ex-gap">
				<HarnessVerdict passed={false} label="Not verified" />
				<span>{cell.read?.problem ?? 'It could not be read and checked against its hash.'}</span>
			</p>
		{:else if run}
			{#if facts.length}
				<dl class="ex-rows">
					{#each facts as [name, value] (name)}
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
			{#if run.input !== undefined}
				<h4>Input</h4>
				<pre>{shown(run.input)}</pre>
			{/if}
			{#if run.output !== undefined}
				<h4>Actual output</h4>
				<pre class="ex-output">{shown(run.output)}</pre>
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
					<summary
						>Trace · {run.trace.length} {run.trace.length === 1 ? 'entry' : 'entries'}</summary
					>
					<pre>{shown(run.trace)}</pre>
				</details>
			{/if}
			{#if Object.keys(run.other).length}
				<details>
					<summary>Also recorded</summary>
					<pre>{shown(run.other)}</pre>
				</details>
			{/if}
		{:else}
			<pre>{shown(cell.read.text)}</pre>
		{/if}
		<a class="ex-link" href={mediaBase + mediaFile(cell.capture)} target="_blank" rel="noreferrer"
			>Open the recorded {label}</a
		>
	</div>
{/if}
