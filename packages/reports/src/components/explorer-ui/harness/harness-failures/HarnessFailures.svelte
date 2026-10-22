<script lang="ts">
	import { harnessFailures } from './harnessFailures';
	let {
		record,
		failures,
		problems = []
	}: {
		/** The record the failures belong to, as shown: its first twelve characters. */
		record: string;
		failures: string[];
		/** What the index could not use of this record; always few, always shown. */
		problems?: string[];
	} = $props();
	let summary = $derived(harnessFailures(failures));
</script>

<div class="hc-failures" role="group" aria-label="Failures of record {record}">
	{#if summary.plain}
		{#each failures as failure, position (position)}<p>{failure}</p>{/each}
	{:else}
		<p>
			<strong>{summary.total} failures</strong>, {summary.causes.length + summary.more} causes
		</p>
		<!-- Paragraphs, not a list: the records are the list, and a failure is not one of its items. -->
		<div class="hc-causes" role="group" aria-label="Failures by cause">
			{#each summary.causes as cause, position (position)}
				<p>
					{#if cause.count > 1}
						<strong>{cause.count} times:</strong>
						{cause.text}
						<span class="hc-muted"
							>For {cause.subjects.join(', ')}{cause.count > cause.subjects.length
								? ` and ${cause.count - cause.subjects.length} more`
								: ''}.</span
						>
					{:else}<span>{cause.text}</span>{/if}
				</p>
			{/each}
			{#if summary.more}
				<p class="hc-muted">{summary.more} more causes are in the complete list.</p>
			{/if}
		</div>
		<details>
			<summary>All {summary.total} failures as recorded</summary>
			<!-- A box of its own that scrolls, so what follows the record stays where it is. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="hc-all" role="region" aria-label="All failures of record {record}" tabindex="0">
				{#each failures as failure, position (position)}<p>{failure}</p>{/each}
			</div>
		</details>
	{/if}
	{#each problems as problem, position (position)}<p>{problem}</p>{/each}
</div>
