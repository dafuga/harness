<script lang="ts">
	import type { CommittedFile, WorktreeState } from '../../../../../src/core/activityTypes';
	import { activityTime } from '../../utils/projects-sessions/activityDisplay';
	import ActivityList from './ActivityList.svelte';
	type Open = { tree: WorktreeState; change: WorktreeState['changes'][number] };
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
	<span class="pa-tags">
		{#each units as unit (unit)}<span class="pa-chip">{unit}</span>{:else}<span class="pa-note"
				>no component</span
			>{/each}
	</span>
{/snippet}

{#snippet openRow({ tree, change }: Open)}
	<div class="pa-row"><code>{change.path}</code></div>
	<div class="pa-meta">
		<span>{change.status}</span>
		<span>{tree.name} · branch {tree.branch ?? 'none'}</span>
		{@render owners(change.units)}
	</div>
{/snippet}

{#snippet fileRow(file: CommittedFile)}
	<div class="pa-row">
		<code>{file.path}</code>
		<a href={href(file.commit)} title={'Last changed by commit ' + file.commit}
			>{file.commit.slice(0, 7)}</a
		>
	</div>
	<div class="pa-meta">
		<span>{file.status}</span>
		<time datetime={file.committedAt}>{activityTime(file.committedAt)} UTC</time>
		{@render owners(file.units)}
	</div>
{/snippet}

<section class="pa-card" aria-label="Recently changed files">
	<div class="pa-head">
		<h2>Recently changed files</h2>
	</div>
	<h3>Uncommitted now</h3>
	{#if !worktrees}
		<p class="pa-empty">Uncommitted changes are not part of a recorded history.</p>
	{:else if open.length}
		<p class="pa-note">
			{open.length}
			{open.length === 1 ? 'file is' : 'files are'} not committed in {dirty} of {worktrees.length}
			checkouts{worktrees.some((tree) => tree.truncated)
				? '; more are changed than are listed'
				: ''}.
		</p>
		<ActivityList
			items={open}
			label="Uncommitted files"
			noun="uncommitted files"
			preview={6}
			row={openRow}
		/>
	{:else}
		<p class="pa-empty">No uncommitted change in any checkout of this repository.</p>
	{/if}
	<h3>Committed</h3>
	{#if files.length}
		<ActivityList
			items={files}
			label="Committed files"
			noun="committed files"
			preview={6}
			row={fileRow}
		/>
	{:else}
		<p class="pa-empty">No committed change is in this history yet.</p>
	{/if}
	<p class="pa-note">Components are named by the registry of {registry}.</p>
</section>
