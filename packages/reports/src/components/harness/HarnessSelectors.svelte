<script lang="ts">
	import type { HarnessIndex, HarnessRevisionSummary } from '../../models/Harness.types';
	import { branchNames, revisionLabel } from '../../utils/harnessAncestry';
	import Select from '../Select.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		index,
		branch,
		commit,
		commits,
		bases,
		from,
		onbranch,
		oncommit,
		onbase,
		tip = null
	}: {
		index: HarnessIndex;
		branch: string;
		commit: string;
		/** The commits of the selected branch, newest first. */
		commits: HarnessRevisionSummary[];
		/** Ancestors a comparison may start from; null outside the comparison view. */
		bases: HarnessRevisionSummary[] | null;
		from: string;
		onbranch: (name: string) => void;
		oncommit: (commit: string) => void;
		onbase: (commit: string) => void;
		/**
		 * In the bar of the explorer: where the tip of the branch is, what the viewed commit is to
		 * it, and the way back to the tip, which is nowhere when the tip is what is shown.
		 */
		tip?: { note: string; viewed: string; href: string | null; onfollow: () => void } | null;
	} = $props();
</script>

<div class={tip ? 'hx-revision' : 'hc-controls'}>
	<label
		><span>{#if tip}<HarnessIcon name="branch" size={18} />{/if}Branch</span>
		<Select label="Branch" bind:value={() => branch, onbranch}>
			{#each branchNames(index) as name (name)}<option value={name}>{name}</option>{/each}
		</Select>
		{#if tip}<small>{tip.note}</small>{/if}
	</label>
	<label
		><span>{#if tip}<HarnessIcon name="commit" size={18} />{/if}Commit</span>
		<Select label="Commit" bind:value={() => commit, oncommit}>
			{#each commits as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
				>{/each}
		</Select>
		<!-- The closed field has room for the short hash; the whole line of a commit is in its option. -->
		{#if tip}<span class="hx-shown" aria-hidden="true">{commit.slice(0, 7)}</span>
			<small>{tip.viewed}</small>{/if}
	</label>
	{#if bases}
		<label
			><span>Base commit</span>
			<Select label="Base commit" bind:value={() => from, onbase}>
				{#each bases as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
					>{/each}
			</Select>
		</label>
	{/if}
	{#if tip}
		<HarnessAction
			href={tip.href ?? undefined}
			disabled={!tip.href}
			icon="arrow-right"
			onclick={tip.onfollow}>Go to tip</HarnessAction
		>
	{/if}
</div>
{#if index.truncated}
	<p class="hc-notice">
		Older commits were left out of this index; it says so rather than hide them.
	</p>
{/if}
