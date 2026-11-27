<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_rwyjhp4g5i -->
<script lang="ts">
	import Modal from '$reports/components/Modal.svelte';
	import TrackerPlanningDetails from '$reports/components/projects-sessions/TrackerPlanningDetails.svelte';
	import type { HomePlan } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { planLabels } from './hubHomePresentation';

	let { plan, close, mac = false }: { plan: HomePlan; close: () => void; mac?: boolean } = $props();
</script>

<Modal
	isOpen
	title={plan.title}
	summary={[plan.project, planLabels[plan.state]].filter(Boolean).join(' · ')}
	variant="section"
	onClose={close}
>
	<TrackerPlanningDetails
		stage={plan.stage}
		planning={plan.planning}
		linkTarget={mac ? 'tracker-artifact' : '_blank'}
	/>
	{#if plan.steps.length}
		<hx-section aria-label="Plan steps">
			<hx-h3>Steps · {plan.done} of {plan.total} complete</hx-h3>
			<hx-ol class="hh-steps">
				{#each plan.steps as step (step.id)}
					<hx-li class="hh-step" data-done={step.done}>{step.title}</hx-li>
				{/each}
			</hx-ol>
		</hx-section>
	{/if}
</Modal>
