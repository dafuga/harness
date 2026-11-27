<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_mzioqvigck -->
<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import { stateLabel } from '$reports/components/projects-sessions/project-overview/projectOverviewPresentation';
	import type { HomeTrackerProject } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';
	import { relativeWhen } from './hubHomePresentation';
	import type { HomeView } from './hubHomeView.types';
	let { view }: { view: HomeView } = $props();
	const available = $derived(view.native ? view.native.projects : view.projects);
	const openable: { id: string; name: string; kind?: string }[] = $derived(available ?? []);
	const tracker = $derived(view.projectDirectory ?? []);
	const byName = $derived(Map.groupBy(openable, (project) => key(project.name)));
	const statusByName = $derived(Map.groupBy(tracker, (project) => key(project.name)));
	const separate = $derived(
		tracker.filter(
			({ name }) => byName.get(key(name))?.length !== 1 || statusByName.get(key(name))?.length !== 1
		)
	);
	const notices = $derived(
		view.native?.notices ?? (view.projectsFailed ? ['Hub projects could not be loaded.'] : [])
	);

	function key(name: string) {
		return name.trim().toLowerCase();
	}

	function detail(project: HomeTrackerProject) {
		const count = project.needsYou;
		return `${stateLabel(project.state)} · ${count.toLocaleString()} ${count === 1 ? 'needs' : 'need'} you`;
	}
	const noActivity = $derived(view.trackerConnected ? 'No Tracker activity · 0 need you' : '');

	function trackerHref(name: string) {
		return `${base}${view.native ? '/tracker' : '/tracker-overview'}?${new URLSearchParams({ project: name })}`;
	}
</script>

{#each notices as notice (notice)}
	<hx-p class="po-notice hh-project-notice" role="status">{notice}</hx-p>
{/each}
{#if openable.length || separate.length}
	<hx-ul class="po-items hh-project-directory" aria-label="Project directory">
		{#each openable as project (project.id)}
			{@const matches = statusByName.get(key(project.name))}
			{@const own =
				byName.get(key(project.name))?.length === 1 && matches?.length === 1
					? matches[0]
					: undefined}
			{@const source = project.kind === 'local' ? 'On this Mac' : 'Hub'}
			{@const change = view.projectSnapshots[project.id]?.commits[0]}
			{@const status = own ? detail(own) : !matches?.length ? noActivity : ''}
			<HubHomeRow title={project.name} meta={status ? `${source} · ${status}` : source}>
				{#snippet trailing()}
					{#if change}<hx-span class="hh-change"
							><hx-code>{shortCommit(change.hash)}</hx-code>
							{relativeWhen(change.authoredAt, view.now)}</hx-span
						>{/if}
					{#if view.native}
						<hx-button
							type="button"
							class="po-action"
							aria-label={`Open ${project.name}`}
							disabled={view.native.projectBusy}
							onclick={() => view.native?.openProject(project.id)}>Open</hx-button
						>
					{:else}
						<hx-a
							class="po-action"
							aria-label={`Open ${project.name}`}
							href={resolve(`/projects/${encodeURIComponent(project.id)}/harness/pages` as '/')}
							>Open</hx-a
						>
					{/if}
				{/snippet}
			</HubHomeRow>
		{/each}
		{#each separate as project (project.name)}
			<HubHomeRow title={project.name} meta={detail(project)}>
				{#snippet trailing()}
					<!-- Both apps supply a fixed route and a URL-encoded project name. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<hx-a
						class="po-action"
						aria-label={`Open ${project.name}`}
						href={trackerHref(project.name)}>Open</hx-a
					>
				{/snippet}
			</HubHomeRow>
		{/each}
	</hx-ul>
{:else if available === null}
	<HubHomeSkeleton rows={3} />
{:else}
	<EmptyState as="div" className="po-empty hh-empty">No projects available.</EmptyState>
{/if}

<style>
	.hh-project-directory {
		max-block-size: 22rem;
		overflow: auto;
		padding: var(--hx-space-4);
	}
	.hh-project-notice {
		margin-block-end: var(--hx-space-12);
	}
</style>
