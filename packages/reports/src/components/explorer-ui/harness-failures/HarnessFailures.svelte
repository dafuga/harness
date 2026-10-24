<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
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

<hx-div class="hc-failures" role="group" aria-label="Failures of record {record}">
	{#if summary.plain}
		{#each failures as failure, position (position)}<hx-p>{failure}</hx-p>{/each}
	{:else}
		<hx-p>
			<hx-strong>{summary.total} failures</hx-strong>, {summary.causes.length + summary.more} causes
		</hx-p>
		<!-- Paragraphs, not a list: the records are the list, and a failure is not one of its items. -->
		<hx-div class="hc-causes" role="group" aria-label="Failures by cause">
			{#each summary.causes as cause, position (position)}
				<hx-p>
					{#if cause.count > 1}
						<hx-strong>{cause.count} times:</hx-strong>
						{cause.text}
						<hx-span class="hc-muted"
							>For {cause.subjects.join(', ')}{cause.count > cause.subjects.length
								? ` and ${cause.count - cause.subjects.length} more`
								: ''}.</hx-span
						>
					{:else}<hx-span>{cause.text}</hx-span>{/if}
				</hx-p>
			{/each}
			{#if summary.more}
				<hx-p class="hc-muted">{summary.more} more causes are in the complete list.</hx-p>
			{/if}
		</hx-div>
		<hx-details>
			<hx-summary>All {summary.total} failures as recorded</hx-summary>
			<!-- A box of its own that scrolls, so what follows the record stays where it is. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<hx-div
				class="hc-all"
				role="region"
				aria-label="All failures of record {record}"
				tabindex="0"
			>
				{#each failures as failure, position (position)}<hx-p>{failure}</hx-p>{/each}
			</hx-div>
		</hx-details>
	{/if}
	{#each problems as problem, position (position)}<hx-p>{problem}</hx-p>{/each}
</hx-div>
