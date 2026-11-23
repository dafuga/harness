<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_krdptrx5io -->
<script lang="ts">
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { displayTime, revisionTime } from '../../utils/shared-primitives/revisionTime';
	import { relativeTime } from './revision-picker/relativeTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import ChoiceRow from './ChoiceRow.svelte';
	import ChoiceRows from './ChoiceRows.svelte';
	import Icon from './Icon.svelte';
	/** Readable revision and deployment context with explicit pinned navigation. */
	let { workspace }: { workspace: Workspace } = $props();
	let branch = $state('');
	let commit = $state('');
	let filter = $state('');
	const snapshot = $derived(workspace.snapshot);
	const revision = $derived(snapshot?.revision);
	/** Branch lists narrow by a filter field once there are more than this many branches. */
	const filterAbove = 7;
	$effect(() => {
		branch = revision?.branch || '';
		commit = revision?.commit || '';
	});
	/** Names an explicit commit separately from a followed branch. */
	const viewed = $derived.by(() => {
		if (!revision) return '';
		if (!revision.atTip) return `Historical commit · ${shortCommit(revision.commit)}`;
		return workspace.pinned
			? `Pinned commit · ${shortCommit(revision.commit)}`
			: 'Current · branch tip';
	});
	const committed = $derived(snapshot ? revisionTime(snapshot, 'commit') : null);
	const tipped = $derived(snapshot ? revisionTime(snapshot, 'branch') : null);
	const environment = $derived(
		workspace.deployments.viewing ? workspace.deployments.environment : null
	);
	const name = $derived(
		environment ? environment : workspace.pinned || !revision?.atTip ? viewed : revision?.branch
	);
	const updated = $derived(
		environment
			? (workspace.deployments.selected?.receipt?.updatedAt ?? null)
			: workspace.pinned
				? committed
				: tipped
	);
	const query = $derived(filter.trim());
	const shownBranches = $derived(
		(snapshot?.branches ?? []).filter((item) =>
			item.name.toLowerCase().includes(query.toLowerCase())
		)
	);
	const typedNew = $derived(
		query !== '' && !(snapshot?.branches ?? []).some((item) => item.name === query)
	);
	/** The date of a commit, as a quiet relative label; empty when the commit is not listed. */
	function dated(hash: string): string {
		const item = snapshot?.commits.find((entry) => entry.hash === hash);
		return item ? relativeTime(item.committedAt ?? item.authoredAt, Date.now()) : '';
	}
	/** Branch navigation resumes live updates without a commit in the URL. */
	function chooseBranch(close?: () => void, target = branch) {
		workspace.deployments.viewing = false;
		close?.();
		void workspace.navigate(workspace.link({ branch: target }));
	}
	function chooseCommit(close: () => void, hash: string) {
		commit = hash;
		workspace.deployments.viewing = false;
		close();
		void workspace.navigate(workspace.link({ branch, commit: hash }));
	}
</script>

{#snippet when(label: string, value: string | null)}<hx-small
		>{label}
		{#if value}<hx-time datetime={value}>{displayTime(value)}</hx-time>{:else}Unknown{/if}</hx-small
	>{/snippet}

{#if snapshot && revision}<hx-div class="revision-picker">
		<hx-div class="revision-choices">
			<ChoiceDialog label="Choose branch" title="" width={320} maxHeight={320} gap={10}>
				{#snippet icon()}<Icon name="branch" size={18} /><hx-span>Branch</hx-span>{/snippet}
				{#snippet children(close: () => void)}
					<ChoiceRows label="Branches">
						{#if snapshot.branches.length > filterAbove}<hx-input
								type="search"
								aria-label="Filter branches"
								placeholder="Filter branches"
								value={filter}
								oninput={(event) => (filter = event.currentTarget.value)}
							/>{/if}
						{#each shownBranches as item (item.name)}<ChoiceRow
								name={item.name}
								meta={dated(item.tip)}
								current={item.name === revision.branch}
								onchoose={() => chooseBranch(close, item.name)}
							/>{/each}{#if typedNew}<ChoiceRow
								name={`View branch "${query}"`}
								onchoose={() => chooseBranch(close, query)}
							/>{/if}
					</ChoiceRows>
					{@render when(`Branch tip ${shortCommit(revision.tip)} committed`, tipped)}{/snippet}
			</ChoiceDialog>
			<ChoiceDialog label="Choose commit" title="" width={440} maxHeight={320} gap={10}>
				{#snippet icon()}<Icon name="commit" size={18} /><hx-span>Commit</hx-span>{/snippet}
				{#snippet children(close: () => void)}<ChoiceRows label="Commits">
						{#each snapshot.commits as item (item.hash)}<ChoiceRow
								name={item.subject || shortCommit(item.hash)}
								meta={`${shortCommit(item.hash)} · ${relativeTime(item.committedAt ?? item.authoredAt, Date.now())}`}
								current={item.hash === commit}
								onchoose={() => chooseCommit(close, item.hash)}
							/>{/each}
					</ChoiceRows>
					{@render when('Commit updated', committed)}{/snippet}
			</ChoiceDialog>
		</hx-div>
		<hx-div class="revision-summary" aria-label="Viewed context">
			<hx-strong title={name}>{name}</hx-strong><hx-small
				>{environment ? 'Updated at ' : '· '}<hx-time
					datetime={updated ?? undefined}
					title="Last updated">{displayTime(updated)}</hx-time
				></hx-small
			>
		</hx-div>
		{#if !environment && (!revision.atTip || workspace.pinned)}<hx-button
				type="button"
				class="go-to-tip"
				onclick={() => chooseBranch()}>{revision.atTip ? 'Follow branch' : 'Go to tip'}</hx-button
			>{/if}
	</hx-div>{/if}

<style>
	@import './revision-picker/revisionPicker.css';
</style>
