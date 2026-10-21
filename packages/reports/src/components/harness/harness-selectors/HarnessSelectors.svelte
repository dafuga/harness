<script lang="ts">
	import type { HarnessIndex, HarnessRevisionSummary } from '../../../models/Harness.types';
	import { branchNames } from '../../../utils/harnessAncestry';
	import { revisionLabel } from './harnessAncestry';
	import Select from '../../Select.svelte';
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
</script>

<div class={tip ? 'hx-revision' : 'hc-controls'}>
	<label
		><span
			>{#if tip}<HarnessIcon name="branch" size={18} />{/if}<span class="revision-name">Branch</span
			></span
		>
		<Select
			label="Branch"
			bind:value={() => branch, onbranch}
			compact={Boolean(tip)}
			display={tip ? branch : undefined}
			title={tip ? `${branch} · ${tip.note}` : undefined}
		>
			{#each branchNames(index) as name (name)}<option value={name}>{name}</option>{/each}
		</Select>
		{#if tip}<small>{tip.note}</small>{/if}
	</label>
	<label
		><span
			>{#if tip}<HarnessIcon name="commit" size={18} />{/if}<span class="revision-name">Commit</span
			></span
		>
		<Select
			label="Commit"
			bind:value={() => commit, oncommit}
			compact={Boolean(tip)}
			display={tip ? commit.slice(0, 7) : undefined}
			title={tip ? `${commit} · ${tip.viewed}` : undefined}
		>
			{#each commits as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
				>{/each}
		</Select>
		<!-- The closed field has room for the short hash; the whole line of a commit is in its option. -->
		{#if tip}<small>{tip.viewed}</small>{/if}
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
			label="Go to tip"
			onclick={tip.onfollow}><span class="revision-name">Go to tip</span></HarnessAction
		>
	{/if}
</div>
