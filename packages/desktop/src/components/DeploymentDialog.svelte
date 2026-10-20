<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { DeploymentPlan, DeploymentReceipt } from '../models/Deployment.types';
	import { displayTime } from '../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import DeploymentDetails from './DeploymentDetails.svelte';
	import Icon from './Icon.svelte';
	/**
	 * Deploy promotes the verified preprod commit to production, whatever environment, branch or
	 * commit is shown. Opening reads the promotion and changes nothing; only Promote to production,
	 * for a production plan with nothing blocking, deploys it, once. The promotion then runs on its
	 * own and is followed here as it is in the deployment activity.
	 */
	let { workspace }: { workspace: Workspace } = $props();
	const deployments = $derived(workspace.deployments);
	const plan = $derived(deployments.plan);
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
	/** The promotion followed here: the one promoted from here, or one of this project under way. */
	const job = $derived.by(() => {
		const value = deployments.job;
		if (previous) return value?.id === previous.id ? value : null;
		return value?.finishedAt === null && value.projectId === workspace.projectId ? value : null;
	});
	const receipt = $derived(job?.receipt ?? null);
	/** Once promoted, production is at the commit of its new receipt. */
	const production = $derived(receipt ?? promotion?.production ?? null);
	/** Production already runs the preprod commit shown; it is drawn as a match, not a gap. */
	const same = $derived(!!production && production.commit === promotion?.preprod?.commit);
	const ready = $derived(
		plan?.environment === 'prod' &&
			!plan.blockers.length &&
			!deployments.pending &&
			plan.id !== previous?.id
	);
	const commits = (count: number) => `${count} ${count === 1 ? 'commit' : 'commits'}`;
	/** How far production is behind preprod as reviewed; preprod may move on during a promotion. */
	const distance = $derived.by(() => {
		if (receipt) return 'The reviewed preprod commit was promoted to production.';
		const behind = promotion?.commitsBehind;
		if (behind === 0) return 'Production matches preprod.';
		if (typeof behind !== 'number') return promotion ? 'The distance to preprod is unknown.' : '';
		if (!production) return `Production has no deployment yet; preprod has ${commits(behind)}.`;
		return `Production is behind preprod by ${commits(behind)}.`;
	});
	/** Until a promotion is followed here: reading it, starting it, or one under way elsewhere. */
	const status = $derived.by(() => {
		if (!deployments.pending) return '';
		if (previous) return 'Starting promotion…';
		const running = deployments.job?.finishedAt === null;
		return running ? 'A production promotion is under way.' : 'Loading promotion…';
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

{#snippet commit(name: string, item: DeploymentReceipt | null)}<dl>
		<dt>{name}</dt>
		{#if item}<dd><code>{item.commit}</code></dd>
			<dd class="when">
				Deployed <time datetime={item.updatedAt}>{displayTime(item.updatedAt)}</time>
			</dd>{:else}<dd class="when">{promotion ? 'Never deployed' : '…'}</dd>{/if}
	</dl>{/snippet}

<ChoiceDialog
	label="Deploy"
	title={refusal || 'Promote preprod to production'}
	disabled={!!refusal}
	width={480}
	maxHeight={720}
	gap={16}
	onopen={opened}
>
	{#snippet icon()}<Icon name="deploy" size={18} />{/snippet}
	{#snippet footer()}<div class="promote">
			{#if !job}<p role="status" aria-live="polite">{status}</p>{/if}
			<button type="button" class="primary" disabled={!ready} onclick={promote}
				>Promote to production</button
			>
		</div>{/snippet}
	<h2>Promote preprod to production</h2>
	<div class="compare" class:same>
		{@render commit('Preprod', promotion?.preprod ?? null)}
		<div class="between">
			<span class="arrow" aria-hidden="true">↓</span>
			{#if distance}<p>{distance}</p>{/if}
		</div>
		{@render commit('Production', production)}
	</div>
	{#if plan?.blockers.length}<ul class="blockers" aria-label="Blockers">
			{#each plan.blockers as blocker, index (index)}<li>{blocker}</li>{/each}
		</ul>{/if}
	{#if deployments.error && deployments.error !== job?.error}<p class="error" role="alert">
			{deployments.error}
		</p>{/if}
	{#if job}<DeploymentDetails deployment={job} showIdentity={false} />{/if}
</ChoiceDialog>

<style>
	h2 {
		margin: 0;
		font-size: 16px;
		color: var(--gold);
	}
	/* Preprod above production, each commit in full at the same place, so the two compare at a
	   glance and wrap rather than being cut on a phone. */
	dl {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 3px;
		margin: 0;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: #062031;
		font-size: 13px;
	}
	dt {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}
	dd {
		margin: 0;
		color: #edf4fa;
	}
	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.when {
		font-size: 12px;
		color: var(--muted);
	}
	/* How far apart they are rides the arrow from preprod to production; teal once they match. */
	.between {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 42px;
		padding-inline: 12px;
		font-size: 13px;
		color: var(--gold);
	}
	.same .between {
		color: #7fe3c0;
	}
	.arrow {
		display: grid;
		place-items: center;
		flex: none;
		width: 22px;
		height: 22px;
		border: 1px solid currentColor;
		border-radius: 50%;
	}
	.between p {
		margin: 0;
	}
	.blockers {
		display: grid;
		gap: 4px;
		margin: 0;
		padding: 8px 12px 8px 28px;
		border-radius: 6px;
		background: rgb(255 171 176 / 0.08);
		font-size: 13px;
		color: #ffabb0;
	}
	.error {
		margin: 0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
	}
	/* The live status beside its one action, in the footer that stays in sight while the promotion,
	   its steps and its receipt scroll above it; the action keeps the end of the row. */
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
	.promote button {
		margin-inline-start: auto;
		padding: 9px 18px;
	}
</style>
