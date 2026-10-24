<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/workspace.svelte';
	import type {
		DeploymentPlan,
		DeploymentReceipt
	} from '../../models/development-tooling/Deployment.types';
	import { displayTime } from '../../utils/development-tooling/revisionTime';
	import ChoiceDialog from '../ChoiceDialog.svelte';
	import DeploymentDetails from './DeploymentDetails.svelte';
	import Icon from '../Icon.svelte';
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

{#snippet commit(name: string, item: DeploymentReceipt | null)}<hx-dl>
		<hx-dt>{name}</hx-dt>
		{#if item}<hx-dd><hx-code>{item.commit}</hx-code></hx-dd>
			<hx-dd class="when">
				Deployed <hx-time datetime={item.updatedAt}>{displayTime(item.updatedAt)}</hx-time>
			</hx-dd>{:else}<hx-dd class="when">{promotion ? 'Never deployed' : '…'}</hx-dd>{/if}
	</hx-dl>{/snippet}

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
	{#snippet footer()}<hx-div class="promote">
			{#if !job}<hx-p role="status" aria-live="polite">{status}</hx-p>{/if}
			<hx-button type="button" class="primary" disabled={!ready} onclick={promote}
				>Promote to production</hx-button
			>
		</hx-div>{/snippet}
	<hx-h2>Promote preprod to production</hx-h2>
	<hx-div class="compare" class:same>
		{@render commit('Preprod', promotion?.preprod ?? null)}
		<hx-div class="between">
			<hx-span class="arrow" aria-hidden="true">↓</hx-span>
			{#if distance}<hx-p>{distance}</hx-p>{/if}
		</hx-div>
		{@render commit('Production', production)}
	</hx-div>
	{#if plan?.blockers.length}<hx-ul class="blockers" aria-label="Blockers">
			{#each plan.blockers as blocker, index (index)}<hx-li>{blocker}</hx-li>{/each}
		</hx-ul>{/if}
	{#if deployments.error && deployments.error !== job?.error}<hx-p class="error" role="alert">
			{deployments.error}
		</hx-p>{/if}
	{#if job}<DeploymentDetails deployment={job} showIdentity={false} />{/if}
</ChoiceDialog>

<style>
	@import './deployment-dialog/deploymentDialog.css';
</style>
