<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { DeploymentPlan, DeploymentReceipt } from '../models/Deployment.types';
	import { displayTime } from '../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
	/**
	 * Deploy promotes the verified preprod commit to production, whatever environment, branch or
	 * commit is shown. Opening reads the promotion and changes nothing; only Promote to production,
	 * for a production plan with nothing blocking, deploys it, once.
	 */
	let { workspace }: { workspace: Workspace } = $props();
	const deployments = $derived(workspace.deployments);
	const plan = $derived(deployments.plan);
	const receipt = $derived(deployments.receipt);
	/** Why Deploy is not offered, or nothing; a promotion under way can always be followed. */
	const refusal = $derived.by(() => {
		if (deployments.pending) return '';
		if (!deployments.supported) return 'Deploy runs in the desktop app, for a local project.';
		if (!workspace.snapshot) return 'No project is shown.';
		return workspace.busy ? 'The project is loading.' : '';
	});
	/** The plan last promoted: it stays in sight while it deploys and is not offered again. */
	let held = $state<DeploymentPlan | null>(null);
	let owner = $state<string | null>(null);
	const previous = $derived(owner === workspace.projectId ? held : null);
	const promotion = $derived((plan ?? previous)?.promotion);
	/** Once promoted, production is at the commit of its new receipt. */
	const production = $derived(receipt ?? promotion?.production ?? null);
	const ready = $derived(
		plan?.environment === 'prod' &&
			!plan.blockers.length &&
			!deployments.pending &&
			!receipt &&
			plan.id !== previous?.id
	);
	const commits = (count: number) => `${count} ${count === 1 ? 'commit' : 'commits'}`;
	/** How far production is behind preprod, where that is known. */
	const distance = $derived.by(() => {
		const behind = receipt ? 0 : promotion?.commitsBehind;
		if (behind === 0) return 'Production matches preprod.';
		if (typeof behind !== 'number') return promotion ? 'The distance to preprod is unknown.' : '';
		if (!production) return `Production has no deployment yet; preprod has ${commits(behind)}.`;
		return `Production is behind preprod by ${commits(behind)}.`;
	});
	/** One live line: reading the promotion, each phase of promoting it, then success. */
	const status = $derived.by(() => {
		if (deployments.pending)
			return previous
				? (deployments.progress?.detail ?? 'Starting promotion…')
				: 'Loading promotion…';
		return receipt ? 'Production is up to date.' : '';
	});
	/** Each opening reads the promotion afresh, unless one is under way to follow. */
	function opened() {
		if (deployments.pending) return;
		held = null;
		void deployments.review();
	}
	function promote() {
		owner = workspace.projectId;
		held = plan;
		void deployments.execute();
	}
</script>

{#snippet commit(name: string, item: DeploymentReceipt | null)}<div>
		<dt>{name}</dt>
		{#if item}<dd><code>{item.commit}</code></dd>
			<dd>
				<small>Deployed <time datetime={item.updatedAt}>{displayTime(item.updatedAt)}</time></small>
			</dd>{:else}<dd>{promotion ? 'Never deployed' : '…'}</dd>{/if}
	</div>{/snippet}

<ChoiceDialog
	label="Deploy"
	title={refusal || 'Promote preprod to production'}
	disabled={!!refusal}
	width={460}
	maxHeight={560}
	gap={12}
	onopen={opened}
>
	{#snippet icon()}<Icon name="deploy" size={18} />{/snippet}
	<h2>Promote preprod to production</h2>
	{#if distance}<p class="distance">{distance}</p>{/if}
	<dl>
		{@render commit('Preprod', promotion?.preprod ?? null)}
		{@render commit('Production', production)}
	</dl>
	{#if plan?.blockers.length}<ul class="blockers" aria-label="Blockers">
			{#each plan.blockers as blocker, index (index)}<li>{blocker}</li>{/each}
		</ul>{/if}
	{#if deployments.error}<p class="error" role="alert">{deployments.error}</p>{/if}
	<div class="promote">
		<p role="status" aria-live="polite" class:done={!!receipt && !deployments.pending}>
			{status}
		</p>
		<button type="button" class="primary" disabled={!ready} onclick={promote}
			>Promote to production</button
		>
	</div>
</ChoiceDialog>

<style>
	h2 {
		margin: 0;
		font-size: 15px;
		color: var(--gold);
	}
	.distance {
		margin: 0;
		font-size: 13px;
	}
	/* Each commit in full under its environment, wrapping rather than cut on a phone. */
	dl {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 10px;
		margin: 0;
		font-size: 13px;
	}
	dl div {
		display: grid;
		gap: 2px;
	}
	dt {
		font-size: 12px;
		color: var(--muted);
	}
	dd {
		color: inherit;
	}
	dd code {
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.blockers {
		display: grid;
		gap: 2px;
		margin: 0;
		padding-inline-start: 20px;
		font-size: 13px;
		color: #ffabb0;
	}
	.error {
		margin: 0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
	}
	/* The live status beside its one action; the action keeps the end of the row. */
	.promote {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.promote p {
		flex: 1 1 160px;
		margin: 0;
		font-size: 12px;
		color: var(--gold);
	}
	.promote p.done {
		color: #7fe3c0;
	}
	.promote button {
		margin-inline-start: auto;
	}
</style>
