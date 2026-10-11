<script lang="ts">
	import type { HarnessIndex, HarnessRevisionSummary } from '../../models/Harness.types';
	import { branchNames, revisionLabel } from '../../utils/harnessAncestry';
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
		<select
			aria-label="Branch"
			value={branch}
			onchange={(event) => onbranch(event.currentTarget.value)}
		>
			{#each branchNames(index) as name (name)}<option value={name}>{name}</option>{/each}
		</select>
	</label>
	<label
		>Commit
		<select
			aria-label="Commit"
			value={commit}
			onchange={(event) => oncommit(event.currentTarget.value)}
		>
			{#each commits as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
				>{/each}
		</select>
	</label>
	{#if bases}
		<label
			>Base commit
			<select
				aria-label="Base commit"
				value={from}
				onchange={(event) => onbase(event.currentTarget.value)}
			>
				{#each bases as item (item.commit)}<option value={item.commit}>{revisionLabel(item)}</option
					>{/each}
			</select>
		</label>
	{/if}
</div>
{#if index.truncated}
	<p class="hc-notice">
		Older commits were left out of this index; it says so rather than hide them.
	</p>
{/if}
