<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import Select from '$shared/Select.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { displayTime, revisionTime } from '../../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
	/** Readable revision and deployment context with explicit pinned navigation. */
	let { workspace }: { workspace: Workspace } = $props();
	let branch = $state('');
	let commit = $state('');
	const snapshot = $derived(workspace.snapshot);
	const revision = $derived(snapshot?.revision);
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
	/** Branch navigation resumes live updates without a commit in the URL. */
	function chooseBranch(close?: () => void) {
		workspace.deployments.viewing = false;
		close?.();
		void workspace.navigate(workspace.link({ branch }));
	}
	function chooseCommit(close: () => void) {
		workspace.deployments.viewing = false;
		close();
		void workspace.navigate(workspace.link({ branch, commit }));
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
				{#snippet children(close: () => void)}<hx-label
						class="picker-field"
						onchange={() => chooseBranch(close)}
						>Branch<Select
							label="Branch"
							expanded
							title={`Tip · ${shortCommit(revision.tip)}`}
							bind:value={branch}
							>{#each snapshot.branches as item (item.name)}<hx-option value={item.name}
									>{item.name}</hx-option
								>{/each}</Select
						></hx-label
					>{@render when(`Branch tip ${shortCommit(revision.tip)} committed`, tipped)}{/snippet}
				{#snippet footer(close: () => void)}<hx-button
						type="button"
						onclick={() => chooseBranch(close)}>View branch</hx-button
					>{/snippet}
			</ChoiceDialog>
			<ChoiceDialog label="Choose commit" title="" width={440} maxHeight={320} gap={10}>
				{#snippet icon()}<Icon name="commit" size={18} /><hx-span>Commit</hx-span>{/snippet}
				{#snippet children(close: () => void)}<hx-label
						class="picker-field"
						onchange={() => chooseCommit(close)}
						>Commit<Select expanded label="Commit" title={viewed} bind:value={commit}
							>{#each snapshot.commits as item (item.hash)}<hx-option value={item.hash}
									>{shortCommit(item.hash)} · {item.subject}</hx-option
								>{/each}</Select
						></hx-label
					>{@render when('Commit updated', committed)}{/snippet}
				{#snippet footer(close: () => void)}<hx-button
						type="button"
						onclick={() => chooseCommit(close)}>View commit</hx-button
					>{/snippet}
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
