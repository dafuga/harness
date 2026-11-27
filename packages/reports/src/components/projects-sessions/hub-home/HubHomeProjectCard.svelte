<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_7oq44aedep -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import { stateLabel } from '$reports/components/projects-sessions/project-overview/projectOverviewPresentation';
	import { count, relativeWhen } from './hubHomePresentation';
	import { projectInventory, inventorySummary } from './hubHomeProjects';
	import type { HomeView } from './hubHomeView.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeDirectory from './HubHomeDirectory.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let { view, open }: { view: HomeView; open: () => void } = $props();
	const latest = $derived(
		view.projects
			?.map((project) => ({
				project,
				commit: view.projectSnapshots[project.id]?.commits[0]
			}))
			.filter(({ commit }) => commit)
			.sort((a, b) => Date.parse(b.commit!.authoredAt) - Date.parse(a.commit!.authoredAt))[0]
	);
	const directory = $derived(view.native || view.projectDirectory !== undefined);
	const listed: { name: string }[] | null = $derived(
		view.native ? view.native.projects : view.projects
	);
	const byName = $derived(Map.groupBy(listed ?? [], ({ name }) => name.trim().toLowerCase()));
	const tracked = $derived(
		Map.groupBy(view.projectDirectory ?? [], ({ name }) => name.trim().toLowerCase())
	);
	const total = $derived(
		(listed?.length ?? 0) +
			[...tracked].reduce(
				(sum, [name, group]) =>
					sum + (group.length === 1 && byName.get(name)?.length === 1 ? 0 : group.length),
				0
			)
	);
</script>

<HubHomeCard
	section="projects"
	total={directory ? total : (view.trackerProjects?.projects.length ?? view.projects?.length)}
	summary={directory
		? listed === null && !total
			? 'Loading projects…'
			: count(total, 'project')
		: view.trackerProjects
			? count(view.trackerProjects.projects.length, 'Tracker project')
			: view.projectsFailed
				? 'Shared projects unavailable'
				: view.projects === null
					? 'Loading projects…'
					: latest?.commit
						? `Last change: ${latest.project.name}, ${relativeWhen(latest.commit.authoredAt, view.now)}`
						: view.projects.length
							? count(view.projects.length, 'shared project')
							: 'No projects yet'}
	{open}
>
	{#if directory}
		<HubHomeDirectory {view} />
	{:else if view.trackerProjects?.projects.length}
		<hx-ul class="po-items">
			{#each view.trackerProjects.projects.slice(0, 4) as project, index (project.agent)}
				<HubHomeRow
					title={project.agent}
					meta={stateLabel(project.state)}
					extra={index >= 2}
					wide={index >= 3}
				/>
			{/each}
		</hx-ul>
	{:else if view.trackerProjects}
		<EmptyState as="div" className="po-empty hh-empty">No Tracker projects yet.</EmptyState>
	{:else if view.projectsFailed}
		<EmptyState as="div" className="po-empty hh-empty">
			{view.needsMac
				? 'Tracker projects appear after your Mac shares them.'
				: 'Open Projects to try the shared list again.'}
		</EmptyState>
	{:else if view.projects === null}
		<HubHomeSkeleton rows={3} />
	{:else if view.projects.length}
		<hx-ul class="po-items">
			{#each view.projects.slice(0, 4) as project, index (project.id)}
				{@const snapshot = view.projectSnapshots[project.id]}
				{@const change = snapshot?.commits[0]}
				<HubHomeRow
					title={project.name}
					meta={snapshot
						? inventorySummary(projectInventory(snapshot))
						: `${project.sourceRepository.owner}/${project.sourceRepository.name}`}
					extra={index >= 2}
					wide={index >= 3}
				>
					{#snippet trailing()}
						{#if change}<hx-span class="hh-change"
								><hx-code>{shortCommit(change.hash)}</hx-code>
								{relativeWhen(change.authoredAt, view.now)}</hx-span
							>{/if}
					{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else}
		<EmptyState as="div" className="po-empty hh-empty"
			><hx-p>No projects yet. Add a repository to see its apps, pages and components.</hx-p>
			<hx-a href={resolve('/projects' as '/')} class="po-action">Add a project</hx-a>
		</EmptyState>
	{/if}
</HubHomeCard>
