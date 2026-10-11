<script lang="ts">
	import type { HarnessIndex, HarnessRevisionSummary } from '../../models/Harness.types';
	import { branchNames, revisionLabel } from '../../utils/harnessAncestry';
	import Select from '../Select.svelte';
	let {
		index,
		branch,
		commit,
		commits,
		bases,
		from,
		onbranch,
		oncommit,
		onbase
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
	} = $props();
</script>

<div class="hc-controls">
	<label
		>Branch
		<Select label="Branch" bind:value={() => branch, onbranch}>
			{#each branchNames(index) as name (name)}<option value={name}>{name}</option>{/each}
		</Select>
	</label>
	<label
		>Commit
		<Select label="Commit" bind:value={() => commit, oncommit}>
			{#each commits as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
				>{/each}
		</Select>
	</label>
	{#if bases}
		<label
			>Base commit
			<Select label="Base commit" bind:value={() => from, onbase}>
				{#each bases as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
					>{/each}
			</Select>
		</label>
	{/if}
</div>
{#if index.truncated}
	<p class="hc-notice">
		Older commits were left out of this index; it says so rather than hide them.
	</p>
{/if}
