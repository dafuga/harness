<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { onDestroy } from 'svelte';
	import type { FeatureWorkSnapshot } from '../../../../../src/services/agents-providers/FeatureWorkService.types';
	import type { FeaturePlanPage as Page } from '../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { createProjectWorkActionsStore } from '../../lib/stores/agents-providers/projectWorkActions.svelte';
	import ProjectWorkFeature from './ProjectWorkFeature.svelte';
	import '../../lib/styles/agents-providers/projectWork.css';
	type Preview = { url?: string; error?: string; loading?: boolean };
	type PhaseState = 'todo' | 'active' | 'done' | 'failed';
	type Phase = { label: string; state: PhaseState; detail: string };
	type Actions = ReturnType<typeof createProjectWorkActionsStore>;
	let { snapshot, loading, error, workspace, actions }: {
		snapshot: FeatureWorkSnapshot | null; loading: boolean; error: string | null; workspace: Workspace; actions: Actions;
	} = $props();
	const images = new SvelteMap<string, Preview>(), id = $props.id();
	let reviewers = $state<Record<string, string>>({});
	const short = (commit: string) => commit.slice(0, 7);
	function imageKey(feature: string, digest: string, page: Page, option: Page['options'][number], projectId: string) {
		return [projectId, digest, feature, page.module, option.id, option.version, option.commit, option.sha256].join(':');
	}
	function clearImages() {
		for (const image of images.values()) if (image.url) URL.revokeObjectURL(image.url);
		images.clear();
	}
	function previewFor(feature: FeatureWorkSnapshot['features'][number], page: Page, option: Page['options'][number]): Preview {
		const plan = feature.plan, projectId = workspace.projectId;
		return plan && projectId ? images.get(imageKey(feature.id, plan.digest, page, option, projectId)) ?? {} : {};
	}
	async function loadPage(feature: FeatureWorkSnapshot['features'][number], page: Page) {
		const plan = feature.plan, projectId = workspace.projectId, bridge = workspace.bridge;
		if (!plan || !projectId || !bridge?.image) return;
		for (const option of page.options) {
			const key = imageKey(feature.id, plan.digest, page, option, projectId);
			if (images.has(key)) continue;
			images.set(key, { loading: true });
			try {
				const bytes = await bridge.image({ projectId, entityId: page.module, commit: option.commit, version: option.version, sha256: option.sha256, option: option.id });
				if (workspace.projectId !== projectId || feature.plan?.digest !== plan.digest) continue;
				const imageBytes = Uint8Array.from(bytes);
				images.set(key, { url: URL.createObjectURL(new Blob([imageBytes.buffer], { type: 'image/png' })) });
				while (images.size > 9) {
					const oldest = images.keys().next().value;
					if (!oldest) break;
					const expired = images.get(oldest); if (expired?.url) URL.revokeObjectURL(expired.url); images.delete(oldest);
				}
			} catch {
				if (workspace.projectId === projectId && feature.plan?.digest === plan.digest) images.set(key, { error: 'This exact design preview could not be read.' });
			}
		}
	}
	$effect(() => {
		const projectId = workspace.projectId, queueCommit = snapshot?.queueCommit;
		void projectId; void queueCommit;
		return clearImages;
	});
	onDestroy(clearImages);
	function summary(feature: FeatureWorkSnapshot['features'][number]) {
		const tasks = feature.tasks.filter((task) => task.belongsToPlan), planned = feature.plan?.tasks.length ?? 0;
		const completed = tasks.filter((task) => task.status === 'accepted').length;
		return tasks.length ? `${completed} of ${tasks.length} tasks completed` : planned ? `${planned} planned tasks, waiting for approval` : 'No stored tasks';
	}
	function phases(feature: FeatureWorkSnapshot['features'][number]): Phase[] {
		const plan = feature.plan, pages = plan?.pages ?? [], selected = pages.every((page) => Boolean(page.selected));
		const approved = Boolean(plan?.approval && plan.approval.digest === plan.digest), tasks = feature.tasks.filter((task) => task.belongsToPlan);
		const failed = tasks.some((task) => task.status === 'failed'), active = tasks.some((task) => task.status === 'running' || task.status === 'review');
		const workState: PhaseState = !approved ? 'todo' : failed ? 'failed' : tasks.length && tasks.every((task) => task.status === 'accepted') ? 'done' : active ? 'active' : 'todo';
		const workDetail = !approved ? 'Waiting for approval' : tasks.length ? `${tasks.filter((task) => task.status === 'accepted').length} of ${tasks.length} tasks completed` : 'No task status recorded';
		return [
			{ label: 'Plan', state: plan ? 'done' : 'todo', detail: plan ? `Revision ${plan.revision} committed` : 'No committed plan' },
			{ label: 'Designs', state: !plan ? 'todo' : selected ? 'done' : 'active', detail: pages.length ? `${pages.filter((page) => page.selected).length} of ${pages.length} pages selected` : 'No affected pages' },
			{ label: 'Approval', state: approved ? 'done' : plan && selected ? 'active' : 'todo', detail: plan?.approval && plan.approval.digest === plan.digest ? `Approved by ${plan.approval.reviewer}` : plan && selected ? 'Ready for review' : 'Waiting for design choices' },
			{ label: 'Work', state: workState, detail: workDetail }
		];
	}
	const tone = (state: PhaseState) => state === 'done' ? 'green' : state === 'active' ? 'amber' : state === 'failed' ? 'red' : 'gray';
	function ready(feature: FeatureWorkSnapshot['features'][number]) {
		return Boolean(feature.plan && feature.plan.tasks.length && feature.plan.pages.every((page) => page.selected));
	}
	function approve(feature: FeatureWorkSnapshot['features'][number]) {
		const plan = feature.plan, reviewer = reviewers[feature.id]?.trim();
		if (plan && ready(feature) && reviewer) void actions.approve({ feature: feature.id, reviewer, expectedDigest: plan.digest });
	}
</script>

<hx-section data-harness-component="project-work" aria-label="Project work" aria-busy={loading}>
	<hx-h2>Work</hx-h2>
	<hx-p class="meta" role="status">{#if loading}{snapshot ? 'Refreshing committed work…' : 'Loading committed work…'}{/if}</hx-p>
	{#if error}<hx-p class="alert" role="alert">{snapshot ? 'Showing the last read; it may be stale.' : 'Work could not be read.'} {error}</hx-p>{/if}
	{#if !snapshot}
		{#if !loading && !error}<hx-p>Feature work is unavailable for this project.</hx-p>{/if}
	{:else}
		<hx-p class="meta" title={snapshot.queueCommit}>{snapshot.queueCommit ? `Queue commit ${short(snapshot.queueCommit)}` : 'The queue has no commit yet.'}</hx-p>
		{#if !snapshot.features.length}<hx-p>No features are committed to this queue.</hx-p>
		{:else}<hx-ul>
			{#each snapshot.features as feature, index (feature.id)}
				<hx-li><hx-details open={index === 0}>
					<hx-summary><hx-strong>{feature.goal || feature.id}</hx-strong><hx-small>{feature.id} · {summary(feature)}</hx-small></hx-summary>
					<hx-div class="phases" role="list" aria-label={`Progress for ${feature.id}`}>
						{#each phases(feature) as phase (phase.label)}<hx-div class="phase" role="listitem"><hx-span class="dot {tone(phase.state)}" aria-hidden="true"></hx-span><hx-span class="phase-label">{phase.label}</hx-span><hx-small>{phase.detail}</hx-small></hx-div>{/each}
					</hx-div>
					{#if feature.plan && !feature.plan.approval}
						<hx-label for="{id}-{feature.id}-reviewer">Approval name</hx-label>
						<hx-input id="{id}-{feature.id}-reviewer" type="text" autocomplete="name" bind:value={reviewers[feature.id]} placeholder="Your name for the approval record" />
						<hx-button type="button" disabled={actions.pending || !ready(feature) || !reviewers[feature.id]?.trim()} onclick={() => approve(feature)}>Approve plan and start work</hx-button>
					{/if}
					<ProjectWorkFeature feature={feature} previewFor={(page, option) => previewFor(feature, page, option)} loadPage={(page) => loadPage(feature, page)} select={(input) => actions.select(input)} pending={actions.pending} />
					{#if actions.error}<hx-p class="alert" role="alert">{actions.error}</hx-p>{/if}
				</hx-details></hx-li>
			{/each}
		</hx-ul>{/if}
	{/if}
</hx-section>

<style>
	.phases { display: grid; gap: 0.35rem; margin: 0.75rem 0; }
	.phase { display: grid; grid-template-columns: 0.8rem 4.2rem 1fr; gap: 0.5rem; align-items: center; }
	.phase-label { font-weight: 650; }
</style>
