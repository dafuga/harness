<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_bhsadknmuu -->
<script lang="ts">
	import { shortCommit } from '../../../helpers/strings/shortCommit';

	import type {
		HarnessIndex,
		HarnessRevisionSummary
	} from '../../../models/explorer-ui/Harness.types';
	import { branchNames } from '../../../utils/explorer-ui/harnessAncestry';
	import { revisionLabel } from './harnessAncestry';
	import Select from '../../shared-primitives/Select.svelte';
	import HarnessAction from '../HarnessAction.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
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
	let branches = $derived(branchNames(index));
</script>

<hx-div
	class={tip ? 'hx-revision' : 'hc-controls'}
	data-harness-component="harness-harness-selectors"
>
	<hx-label
		><hx-span
			>{#if tip}<HarnessIcon name="branch" size={18} />{/if}<hx-span class="revision-name"
				>Branch</hx-span
			></hx-span
		>
		<Select
			label="Branch"
			bind:value={() => branch, onbranch}
			compact={Boolean(tip)}
			display={branch || undefined}
			disabled={!branches.length}
			title={tip ? `${branch} · ${tip.note}` : branch}
		>
			{#each branches as name (name)}<hx-option value={name}>{name}</hx-option>{:else}<hx-option
					value=""
					disabled>No branches recorded</hx-option
				>{/each}
		</Select>
		{#if tip}<hx-small>{tip.note}</hx-small>{/if}
	</hx-label>
	<hx-label
		><hx-span
			>{#if tip}<HarnessIcon name="commit" size={18} />{/if}<hx-span class="revision-name"
				>Commit</hx-span
			></hx-span
		>
		<Select
			label="Commit"
			bind:value={() => commit, oncommit}
			compact={Boolean(tip)}
			display={commit ? shortCommit(commit) : undefined}
			disabled={!commits.length}
			title={tip ? `${commit} · ${tip.viewed}` : commit}
		>
			{#each commits as item (item.commit)}<hx-option value={item.commit}
					>{revisionLabel(item)}</hx-option
				>{:else}<hx-option value="" disabled>No commits recorded</hx-option>{/each}
		</Select>
		<!-- The closed field has room for the short hash; the whole line of a commit is in its option. -->
		{#if tip}<hx-small>{tip.viewed}</hx-small>{/if}
	</hx-label>
	{#if bases}
		<hx-label
			><hx-span>Base commit</hx-span>
			<Select
				label="Base commit"
				bind:value={() => from, onbase}
				display={from ? shortCommit(from) : undefined}
				title={from}
				disabled={!bases.length}
			>
				{#each bases as item (item.commit)}<hx-option value={item.commit}
						>{revisionLabel(item)}</hx-option
					>{:else}<hx-option value="" disabled>No base commits recorded</hx-option>{/each}
			</Select>
		</hx-label>
	{/if}
	{#if tip}
		<HarnessAction
			href={tip.href ?? undefined}
			disabled={!tip.href}
			icon="arrow-right"
			label="Go to tip"
			onclick={tip.onfollow}><hx-span class="revision-name">Go to tip</hx-span></HarnessAction
		>
	{/if}
</hx-div>

<style>
	@media (forced-colors: none) {
		:global([data-harness-component='harness-harness-selectors'].hc-controls .has-display select) {
			color: transparent;
		}
	}
	:global([data-harness-component='harness-harness-selectors'].hc-controls .report-select-value) {
		letter-spacing: var(--hx-style-tracking-normal);
		text-transform: none;
	}
</style>
