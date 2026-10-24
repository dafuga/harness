<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Open } from './ActivityFiles.types';

	import type { CommittedFile, WorktreeState } from '../../../../../src/core/activityTypes';
	import { activityTime } from '../../utils/projects-sessions/activityDisplay';
	import ActivityList from './ActivityList.svelte';
	let {
		files,
		worktrees,
		href,
		registry
	}: {
		files: CommittedFile[];
		/** Null where no checkout can be asked: a recorded history has only committed work. */
		worktrees: WorktreeState[] | null;
		/** The page of a commit in the console of this repository. */
		href: (commit: string) => string;
		/** Which registry names the components: that of the checkout now, or of a commit. */
		registry: string;
	} = $props();
	let open = $derived<Open[]>(
		(worktrees ?? []).flatMap((tree) => tree.changes.map((change) => ({ tree, change })))
	);
	let dirty = $derived((worktrees ?? []).filter((tree) => tree.changes.length).length);
</script>

{#snippet owners(units: string[])}
	<hx-span class="pa-tags">
		{#each units as unit (unit)}<hx-span class="pa-chip">{unit}</hx-span>{:else}<hx-span
				class="pa-note">no component</hx-span
			>{/each}
	</hx-span>
{/snippet}

{#snippet openRow({ tree, change }: Open)}
	<hx-div class="pa-row"><hx-code>{change.path}</hx-code></hx-div>
	<hx-div class="pa-meta">
		<hx-span>{change.status}</hx-span>
		<hx-span>{tree.name} · branch {tree.branch ?? 'none'}</hx-span>
		{@render owners(change.units)}
	</hx-div>
{/snippet}

{#snippet fileRow(file: CommittedFile)}
	<hx-div class="pa-row">
		<hx-code>{file.path}</hx-code>
		<hx-a href={href(file.commit)} title={'Last changed by commit ' + file.commit}
			>{file.commit.slice(0, 7)}</hx-a
		>
	</hx-div>
	<hx-div class="pa-meta">
		<hx-span>{file.status}</hx-span>
		<hx-time datetime={file.committedAt}>{activityTime(file.committedAt)} UTC</hx-time>
		{@render owners(file.units)}
	</hx-div>
{/snippet}

<hx-section class="pa-card" aria-label="Recently changed files">
	<hx-div class="pa-head">
		<hx-h2>Recently changed files</hx-h2>
	</hx-div>
	<hx-h3>Uncommitted now</hx-h3>
	{#if !worktrees}
		<hx-p class="pa-empty">Uncommitted changes are not part of a recorded history.</hx-p>
	{:else if open.length}
		<hx-p class="pa-note">
			{open.length}
			{open.length === 1 ? 'file is' : 'files are'} not committed in {dirty} of {worktrees.length}
			checkouts{worktrees.some((tree) => tree.truncated)
				? '; more are changed than are listed'
				: ''}.
		</hx-p>
		<ActivityList
			items={open}
			label="Uncommitted files"
			noun="uncommitted files"
			preview={6}
			row={openRow}
		/>
	{:else}
		<hx-p class="pa-empty">No uncommitted change in any checkout of this repository.</hx-p>
	{/if}
	<hx-h3>Committed</hx-h3>
	{#if files.length}
		<ActivityList
			items={files}
			label="Committed files"
			noun="committed files"
			preview={6}
			row={fileRow}
		/>
	{:else}
		<hx-p class="pa-empty">No committed change is in this history yet.</hx-p>
	{/if}
	<hx-p class="pa-note">Components are named by the registry of {registry}.</hx-p>
</hx-section>
