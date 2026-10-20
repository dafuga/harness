<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { DeploymentActivity } from '../models/Deployment.types';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import DeploymentDetails from './DeploymentDetails.svelte';
	import DeploymentRoute from './DeploymentRoute.svelte';
	/**
	 * The light of the deployments of this device's projects, whichever project is shown. It pulses
	 * while one is queued or runs and opens the active and recent ones, newest first; choosing one
	 * follows it live. Nothing here starts, stops or repeats a deployment.
	 */
	let { workspace }: { workspace: Workspace } = $props();
	const activity = $derived(workspace.activity);
	const items = $derived(activity.items);
	const destination = (item: DeploymentActivity) => `${item.projectId}:${item.environment}`;
	/** A failure stands until a newer deployment to the same destination follows it. */
	function stands(item: DeploymentActivity) {
		return items.find((one) => destination(one) === destination(item)) === item;
	}
	const failed = $derived(items.filter((item) => item.phase === 'failed' && stands(item)).length);
	const summary = $derived.by(() => {
		const count = activity.activeCount;
		const running = `${count || 'No'} active deployment${count === 1 ? '' : 's'}`;
		return failed ? `${running} · ${failed} failed` : running;
	});
	/** Idle ring, dot after a deployment, diamond after a failure, haloed dot while one is under way. */
	const light = $derived.by(() => {
		if (activity.activeCount) return 'active';
		if (failed) return 'failed';
		return items.length ? 'recent' : 'idle';
	});
	const title = $derived.by(() => {
		const said = light === 'idle' ? 'No deployments yet; local ones show here' : summary;
		return activity.error ? `${said}. ${activity.error}` : said;
	});
	function phase(item: DeploymentActivity) {
		const step = item.steps.find((one) => one.id === item.step)?.title;
		if (item.phase === 'queued') return 'Queued';
		if (item.phase === 'complete') return 'Deployed';
		if (item.phase === 'failed') return step ? `Failed at ${step}` : 'Failed';
		return step ?? 'Starting';
	}
	function lightState(item: DeploymentActivity) {
		if (item.phase === 'queued' || item.phase === 'failed') return item.phase;
		return item.phase === 'complete' ? 'recent' : 'active';
	}
	let chosen = $state<string | null>(null);
	/** The chosen deployment as it is now: it is followed live while it is shown. */
	const selected = $derived(items.find((item) => item.id === chosen) ?? null);
	let back = $state<HTMLButtonElement>();
	let list = $state<HTMLElement>();
	onMount(() => workspace.activity.watch());
	/** Focus follows the view: Back once a deployment is shown, that deployment once back. */
	async function choose(id: string | null) {
		const left = chosen;
		chosen = id;
		await tick();
		if (id) return back?.focus();
		const rows = Array.from(list?.querySelectorAll<HTMLButtonElement>('button[data-id]') ?? []);
		rows.find((row) => row.dataset.id === left)?.focus();
	}
	/** Each opening starts at the list; a deployment shown when it closed is not shown again. */
	async function opened() {
		if (chosen === null) return;
		chosen = null;
		await tick();
		list?.querySelector('button')?.focus();
	}
</script>

<div class="deployment-activity">
	<ChoiceDialog
		label="Deployments"
		{title}
		width={420}
		maxHeight={560}
		gap={12}
		activeCount={activity.activeCount}
		onopen={() => void opened()}
	>
		{#snippet icon()}<span class="light pulse" data-state={light} aria-hidden="true"
			></span>{/snippet}
		{#if activity.error}<p class="error" role="alert">{activity.error}</p>{/if}
		{#if selected}<button
				type="button"
				class="back"
				bind:this={back}
				onclick={() => void choose(null)}
				><span aria-hidden="true">←</span> Back to deployments</button
			>
			<DeploymentDetails deployment={selected} />
		{:else}<h2>Deployments</h2>
			<p class="summary" role="status">{summary}</p>
			{#if items.length}<ul bind:this={list}>
					{#each items as item (item.id)}<li>
							<button
								type="button"
								class="job"
								data-id={item.id}
								aria-label="{item.environment} deployment, from {item.sourceEnvironment ??
									item.branch} to {item.environment}, {item.projectName}, {phase(item)}"
								onclick={() => void choose(item.id)}
							>
								<span class="light" data-state={lightState(item)} aria-hidden="true"></span>
								<strong>{item.environment} deployment</strong>
								<small><DeploymentRoute deployment={item} /></small>
								<small>{phase(item)} · {item.projectName} · {item.commit.slice(0, 7)}</small>
							</button>
						</li>{/each}
				</ul>{:else}<p class="summary">
					Deployments of local projects show here while they run, and for a while after.
				</p>{/if}
		{/if}
	</ChoiceDialog>
</div>

<style>
	/* The light keeps the end of the place it is given; in a phone's wrapping bar, after the brand. */
	.deployment-activity {
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}
	@media (max-width: 560px) {
		.deployment-activity {
			order: -1;
		}
	}
	.light {
		flex: none;
		width: 10px;
		height: 10px;
		border: 2px solid var(--muted);
		border-radius: 50%;
	}
	.light[data-state='queued'] {
		border-color: var(--gold);
	}
	.light[data-state='recent'] {
		border-color: #7fe3c0;
		background: #7fe3c0;
	}
	.light[data-state='failed'] {
		border-color: #ffabb0;
		border-radius: 2px;
		background: #ffabb0;
		transform: rotate(45deg) scale(0.9);
	}
	.light[data-state='active'] {
		border-color: var(--gold);
		background: var(--gold);
		box-shadow: 0 0 0 3px rgb(255 208 53 / 0.25);
	}
	/* Only the light in the bar pulses, and not where motion is reduced; its halo stays. */
	.pulse[data-state='active'] {
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 6px rgb(255 208 53 / 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse[data-state='active'] {
			animation: none;
		}
	}
	h2 {
		margin: 0;
		font-size: 15px;
		color: var(--gold);
	}
	.summary {
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	.error {
		margin: 0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
	}
	ul {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* A row names its destination first, then how it stands, its project and its commit. */
	.job {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 2px 10px;
		width: 100%;
		padding: 8px 10px;
		font-size: 13px;
	}
	small {
		grid-column: 2;
		overflow-wrap: anywhere;
	}
	.back {
		justify-self: start;
		padding: 6px 10px;
		font-size: 12px;
	}
</style>
