<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_yclqwrgobq -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import type { ProjectSummary } from 'collaboration';
	import type { ProjectSnapshot } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
	import type { CatalogEntity } from '../../../../../desktop/src/models/development-tooling/DesktopEntity.types';
	import { resolve } from '$app/paths';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import { inventorySummary, projectInventory } from './hubHomeProjects';
	import { count, when } from './hubHomePresentation';
	import type { ReadHomeProject } from './hubHomeView.types';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		projects,
		snapshots,
		readProject
	}: {
		projects: ProjectSummary[] | null;
		snapshots: Record<string, ProjectSnapshot>;
		readProject: ReadHomeProject;
	} = $props();
	let chosen = $state<string>();
	let failed = $state(false);
	let loaded = $state<Record<string, ProjectSnapshot>>({});
	let showAll = $state(false);
	const current = $derived(projects?.find((project) => project.id === chosen) ?? projects?.[0]);
	const detail = $derived(current ? (loaded[current.id] ?? snapshots[current.id]) : undefined);
	const inventory = $derived(detail ? projectInventory(detail) : null);

	$effect(() => {
		const id = current?.id;
		failed = false;
		showAll = false;
		if (!id) return;
		let active = true;
		void untrack(() => readProject(id)).then(
			(snapshot) => {
				if (active) loaded = { ...loaded, [id]: snapshot };
			},
			() => {
				if (active) failed = true;
			}
		);
		return () => {
			active = false;
		};
	});
</script>

{#snippet tags(title: string, entities: CatalogEntity[])}
	<hx-h4 class="po-label">{title} <hx-span class="po-band-count">{entities.length}</hx-span></hx-h4>
	<hx-ul class="hh-tags">
		{#each showAll ? entities : entities.slice(0, 8) as entity (entity.id)}
			<hx-li class="hh-tag">{entity.title}</hx-li>
		{/each}
		{#if entities.length > 8}
			<hx-li
				><hx-button
					type="button"
					class="hh-tag hh-tag-more"
					aria-expanded={showAll}
					onclick={() => (showAll = !showAll)}
					>{showAll ? 'Show fewer' : `+${entities.length - 8} more`}</hx-button
				></hx-li
			>
		{/if}
	</hx-ul>
{/snippet}

{#if projects === null}
	<HubHomeSkeleton rows={5} />
{:else if !projects.length || !current}
	<EmptyState as="div" className="po-empty hh-empty"
		>No shared projects yet. <hx-a href={resolve('/projects' as '/')}>Open projects</hx-a
		></EmptyState
	>
{:else}
	<hx-div class="hh-split hh-split-projects">
		<hx-div class="hh-split-list">
			<hx-ul class="po-items">
				{#each projects as project (project.id)}
					{@const snapshot = loaded[project.id] ?? snapshots[project.id]}
					{@const last = snapshot?.commits[0]}
					<hx-li class="po-item" aria-current={project.id === current.id ? 'true' : undefined}>
						<hx-button type="button" class="po-item-open" onclick={() => (chosen = project.id)}>
							<hx-span class="po-item-text"
								><hx-span class="po-item-title">{project.name}</hx-span>
								<hx-span class="po-item-meta"
									>{snapshot
										? inventorySummary(projectInventory(snapshot))
										: `${project.sourceRepository.owner}/${project.sourceRepository.name}`}</hx-span
								></hx-span
							>
							{#if last}<hx-span class="hh-change"
									><hx-code>{shortCommit(last.hash)}</hx-code> {when(last.authoredAt)}</hx-span
								>{/if}
						</hx-button>
					</hx-li>
				{/each}
			</hx-ul>
		</hx-div>
		<hx-section class="hh-project-detail" aria-label={current.name}>
			<hx-div class="hh-detail-head">
				<hx-h3 class="po-name">{current.name}</hx-h3>
				{#if inventory}<hx-p class="po-sessions">{inventorySummary(inventory)}</hx-p>{/if}
				<hx-a
					class="po-action"
					href={resolve(`/projects/${encodeURIComponent(current.id)}/harness/pages` as '/')}
					>Open project</hx-a
				>
			</hx-div>
			{#if failed}<hx-p class="po-notice" role="status">The project catalog could not be read.</hx-p
				>
			{:else if !detail || !inventory}<HubHomeSkeleton rows={4} />
			{:else}
				<hx-h4 class="po-label">Apps</hx-h4>
				<hx-ul class="hh-apps">
					{#each inventory.apps as [name, counts] (name)}
						<hx-li class="hh-app">
							<hx-h5 class="hh-app-name">{name}</hx-h5>
							<hx-p class="hh-app-counts"
								>{count(counts.pages, 'page')} · {count(counts.components, 'component')}</hx-p
							>
						</hx-li>
					{/each}
				</hx-ul>
				{@render tags('Pages', inventory.pages)}
				{@render tags('Components', inventory.components)}
				<hx-h4 class="po-label">Change history</hx-h4>
				{#if !detail.commits.length}<hx-p class="po-sessions">No commits available.</hx-p>{/if}
				<hx-ol class="hh-history">
					{#each detail.commits.slice(0, 10) as commit (commit.hash)}
						<hx-li class="hh-commit">
							<hx-code>{shortCommit(commit.hash)}</hx-code>
							<hx-span class="po-item-title">{commit.subject}</hx-span>
							<hx-time class="po-item-meta" datetime={commit.authoredAt}
								>{when(commit.authoredAt)}</hx-time
							>
						</hx-li>
					{/each}
				</hx-ol>
			{/if}
		</hx-section>
	</hx-div>
{/if}
