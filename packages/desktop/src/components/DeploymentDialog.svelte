<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { DeploymentPlan, DeploymentReceipt } from '../models/Deployment.types';
	import { displayTime } from '../utils/revisionTime';
	import ChoiceDialog from './ChoiceDialog.svelte';
	import Icon from './Icon.svelte';
	/**
	 * Deploy is a local desktop action from the shown branch tip to the chosen environment. Opening
	 * it changes nothing: Review deployment only reads a plan, and only Deploy to the environment,
	 * for the plan of this environment and commit with nothing blocking, deploys it, once.
	 */
	let { workspace }: { workspace: Workspace } = $props();
	const deployments = $derived(workspace.deployments);
	const environment = $derived(deployments.environment);
	const revision = $derived(workspace.snapshot?.revision);
	const plan = $derived(deployments.plan);
	const receipt = $derived(deployments.receipt);
	/** Why Deploy is not offered here, or nothing when it is. */
	const refusal = $derived.by(() => {
		if (!deployments.supported) return 'Deploy runs in the desktop app, for a local project.';
		if (!revision) return 'No project is shown.';
		if (workspace.pinned || !revision.atTip) return 'Deploy starts from the branch tip.';
		return workspace.busy ? 'The project is loading.' : '';
	});
	/** The plan was reviewed for what is chosen now: this environment and the shown commit. */
	const current = $derived(
		!!plan && plan.environment === environment && plan.commit === revision?.commit
	);
	/** The plan that has deployed is not offered again; its deploying is told apart from review. */
	let spent = $state('');
	let deploying = $state(false);
	const ready = $derived(
		!refusal && current && !plan?.blockers.length && !deployments.pending && plan?.id !== spent
	);
	async function execute() {
		const id = plan?.id ?? '';
		deploying = true;
		try {
			await deployments.execute();
			if (deployments.receipt && !deployments.error) spent = id;
		} finally {
			deploying = false;
		}
	}
	const short = (hash: string) => hash.slice(0, 7);
</script>

{#snippet reviewed(item: DeploymentPlan)}
	{#if !current}<p class="note">
			This plan is for {item.environment} at {short(item.commit)}. Review again.
		</p>{/if}
	<section>
		<h3>Steps</h3>
		<ol>
			{#each item.steps as step, index (index)}<li>{step}</li>{/each}
		</ol>
	</section>
	{#if item.blockers.length}<section class="blockers">
			<h3>Blockers</h3>
			<ul>
				{#each item.blockers as blocker, index (index)}<li>{blocker}</li>{/each}
			</ul>
		</section>{:else}<small>No blockers.</small>{/if}
	<small>Plan expires <time datetime={item.expiresAt}>{displayTime(item.expiresAt)}</time></small>
{/snippet}

{#snippet deployed(item: DeploymentReceipt)}<section class="receipt" role="status">
		<h3>Deployed to {item.environment} · <strong>Verification succeeded</strong></h3>
		<dl>
			<dt>Deployment</dt>
			<dd><code>{item.deploymentId}</code></dd>
			<dt>Address</dt>
			<dd><code>{item.url}</code></dd>
			<dt>Commit</dt>
			<dd><code>{short(item.commit)}</code></dd>
			<dt>Deployed</dt>
			<dd><time datetime={item.updatedAt}>{displayTime(item.updatedAt)}</time></dd>
		</dl>
	</section>{/snippet}

<ChoiceDialog
	label="Deploy"
	title={refusal || `Deploy to ${environment}`}
	disabled={!!refusal}
	width={460}
	maxHeight={640}
	gap={12}
>
	{#snippet icon()}<Icon name="deploy" size={18} />{/snippet}
	{#snippet children(close: () => void)}
		<h2>Deployment to {environment}</h2>
		<dl>
			<dt>Environment</dt>
			<dd>{environment}</dd>
			<dt>Source branch</dt>
			<dd>{revision?.branch ?? 'Unknown'}</dd>
			<dt>Source commit</dt>
			<dd><code>{revision?.commit ?? 'Unknown'}</code></dd>
			<dt>Adapter</dt>
			<dd>{plan?.adapter ?? 'Shown on review'}</dd>
			<dt>Target</dt>
			<dd>{plan?.target ?? 'Shown on review'}</dd>
		</dl>
		{#if plan}{@render reviewed(plan)}{/if}
		{#if deployments.pending}<p class="note" role="status">
				{deploying ? `Deploying to ${environment}…` : 'Reviewing the deployment…'}
			</p>{/if}
		{#if deployments.error}<p class="error" role="alert">{deployments.error}</p>{/if}
		{#if receipt}{@render deployed(receipt)}{/if}
		<div class="deploy-actions">
			<button
				type="button"
				disabled={!!refusal || deployments.pending}
				onclick={() => void deployments.review()}>Review deployment</button
			>{#if plan}<button
					type="button"
					class="primary"
					disabled={!ready}
					onclick={() => void execute()}>Deploy to {environment}</button
				>{/if}<button type="button" onclick={close}>Close</button>
		</div>
	{/snippet}
</ChoiceDialog>

<style>
	h2 {
		margin: 0;
		font-size: 15px;
		color: var(--gold);
	}
	h3 {
		margin: 0 0 4px;
		font-size: 12px;
		color: var(--muted);
	}
	dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px 14px;
		margin: 0;
		font-size: 13px;
	}
	dt {
		color: var(--muted);
	}
	dd {
		color: inherit;
		overflow-wrap: anywhere;
	}
	ol,
	ul {
		display: grid;
		gap: 2px;
		margin: 0;
		padding-inline-start: 20px;
		font-size: 13px;
	}
	.blockers li {
		color: #ffabb0;
	}
	.note {
		margin: 0;
		font-size: 12px;
		color: var(--gold);
	}
	.error {
		margin: 0;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
	}
	.receipt {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 8px;
	}
	.receipt strong {
		color: #7fe3c0;
	}
	.deploy-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
