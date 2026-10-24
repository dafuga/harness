<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { LevelValidator } from '../../../../game/src/index';
	import type { LevelPlanning, LevelProposal } from '../../../../game/src/index';
	import type { ProviderId, ProviderState } from '../../models/development-tooling/Desktop.types';
	import GameLevelBrief from './GameLevelBrief.svelte';
	import GameLevelReview from './GameLevelReview.svelte';
	import type { GameLevelPlanProps as Props, LevelStatus, LevelStep } from './GameLevelPlan.types';
	/**
	 * A new level goes from concept to brief to a generated proposal, then waits for a person to
	 * approve and build it. Generating never saves or approves; a later edit to the concept, brief
	 * or dimension withdraws approval and the build, and keeps the work.
	 */
	let { context, run = $bindable(), change }: Props = $props();
	const { view, document, readonly } = $derived(context);
	const order: LevelStep[] = ['concept', 'brief', 'review'];
	const titles: Record<LevelStep, string> = {
		concept: 'What is this level?',
		brief: 'Describe the level',
		review: 'Review the proposal',
		built: 'Level built'
	};
	const planning = $derived<LevelPlanning>(view.planning ?? { concept: '', description: '' });
	const proposal = $derived(planning.proposal);
	const current = $derived(LevelValidator.isCurrent(view));
	const ready = $derived(LevelValidator.isReady(view));
	let stage = $state<LevelStep>(opening());
	let providers = $state.raw<ProviderState[] | null>(null);
	let provider = $state<ProviderId>('codex');
	let model = $state('');
	let busy = $state(false);
	let error = $state('');
	let generation = 0;
	let asked = false;
	const option = $derived(providers?.find((item) => item.id === provider));
	const status = $derived<LevelStatus>({ busy, readonly, reason: blocked(), error });
	/** The step asked for, as far as the level allows: a review needs a current proposal. */
	const step = $derived.by<LevelStep>(() => {
		if (stage === 'concept') return 'concept';
		if (stage !== 'brief' && ready) return 'built';
		return stage !== 'brief' && current ? 'review' : 'brief';
	});
	const owner = $derived([context.projectId, context.commit, view.id].join(':'));
	const text = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
	/** What a generated result must still match when it returns. */
	const inputs = () => {
		const { concept, description } = planning;
		const { projectId, revision } = context;
		return JSON.stringify([projectId, revision, view.id, concept, description, view.dimension]);
	};
	function opening(): LevelStep {
		if (ready) return 'built';
		if (current) return 'review';
		return planning.description.trim() ? 'brief' : 'concept';
	}
	function blocked() {
		const { commit, projectId, revision, bridge } = context;
		const described = planning.concept.trim() && planning.description.trim();
		const limits: [unknown, string][] = [
			[commit, 'History is read-only, so levels are not generated here.'],
			[readonly, 'This game is read-only, so levels are not generated here.'],
			[!projectId, 'Generating a level needs a saved project; this demo is not saved.'],
			[!revision, 'Reload the game to generate a level.'],
			[!bridge?.gameLevelGenerate, 'This version of the app cannot generate levels.'],
			[!providers, 'Looking for local models…'],
			[!option?.available, option?.reason || 'No local model is available for levels.'],
			[!model, 'Choose a model to generate the level.'],
			[!described, 'Write the concept and the level brief first.']
		];
		return limits.find(([limited]) => limited)?.[1] ?? '';
	}
	/** Another view or project opens at its own step; a pending result for the last is dropped. */
	$effect(() => {
		void owner;
		untrack(() => ([stage, busy, error] = [opening(), false, '']));
		return () => void generation++;
	});
	/** Local models are discovered once, and only where a level could be generated. */
	$effect(() => {
		const { projectId, commit, bridge } = context;
		if (asked || readonly || commit || !projectId || !bridge?.gameLevelGenerate) return;
		asked = true;
		void bridge
			.providers()
			.then((list) => (providers = list))
			.catch((cause) => ([providers, error] = [[], text(cause)]));
	});
	/** An unusable provider gives way to a usable one, and an unlisted model to the default. */
	$effect(() => {
		if (providers && !option?.available)
			provider = providers.find((item) => item.available)?.id ?? provider;
	});
	$effect(() => {
		if (!option?.models.some((item) => item.id === model))
			model = option?.models.find((item) => item.isDefault)?.id || option?.models[0]?.id || '';
	});
	/** A change to what a proposal is made from withdraws approval and the build; work stays. */
	function revise(patch: Partial<LevelPlanning>, dimension = view.dimension) {
		const next = { ...planning, ...patch, approved: undefined, built: undefined };
		if (!readonly) change({ dimension, planning: next });
	}
	/** Sends the request as it stands; a result for another brief, view or revision is dropped. */
	async function generate(feedback = '') {
		const { projectId, revision, bridge } = context;
		if (busy || status.reason || !projectId || !revision || !bridge?.gameLevelGenerate) return;
		const request = feedback.trim();
		const base = { projectId, document, viewId: view.id, expectedRevision: revision };
		const input = { ...base, provider, model, ...(request ? { feedback: request } : {}) };
		const id = ++generation,
			sent = inputs();
		[busy, error] = [true, ''];
		if (planning.approved || planning.built) revise({});
		try {
			const result = await bridge.gameLevelGenerate(input);
			if (id !== generation) return;
			if (sent === inputs()) adopt(result.proposal);
			else error = 'The level changed while generating, so that result was set aside.';
		} catch (cause) {
			if (id === generation) error = text(cause);
		} finally {
			if (id === generation) busy = false;
		}
	}
	function adopt(next: LevelProposal) {
		if (!LevelValidator.planning({ ...planning, proposal: next }))
			return void (error = 'The proposal was not a usable level. Generate again.');
		revise({ proposal: next });
		stage = 'review';
	}
	function approve() {
		if (readonly || busy || !current || !proposal) return;
		change({ planning: { ...planning, approved: proposal.id } });
	}
	/** Copies the approved layout into the view and restarts this level's preview at its spawn. */
	function build() {
		if (readonly || busy || !current || !proposal || planning.approved !== proposal.id) return;
		const { id } = view;
		const { spawn } = proposal.layout;
		const world = $state.snapshot(proposal.layout);
		change({ world, planning: { ...planning, built: proposal.id } });
		const trace = run.trace.filter((entry) => entry.viewId !== id);
		const state = { ...run.state, x: spawn.x, y: spawn.z };
		run = { ...run, state, trace, completed: [], progress: { ...run.progress, [id]: [] } };
		stage = 'built';
	}
</script>

<hx-section class="plan" data-harness-component="game-level-plan" aria-busy={busy}>
	<hx-header>
		<hx-h2>{titles[step]}</hx-h2>
		{#if step !== 'built'}<hx-small>Step {order.indexOf(step) + 1} of 3</hx-small>{/if}
	</hx-header>
	{#if step === 'concept' || step === 'brief'}
		<GameLevelBrief
			{step}
			{planning}
			dimension={view.dimension}
			{providers}
			bind:provider
			bind:model
			{status}
			reviewable={current}
			{revise}
			reshape={(dimension) => revise({}, dimension)}
			generate={() => generate()}
			go={(next) => (stage = next)}
		/>
	{:else if proposal}
		{#key proposal.id}
			<GameLevelReview
				{proposal}
				{providers}
				approved={planning.approved === proposal.id}
				built={step === 'built'}
				{status}
				regenerate={generate}
				{approve}
				{build}
				edit={() => (stage = 'brief')}
			/>
		{/key}
	{/if}
</hx-section>

<style>
	.plan {
		display: grid;
		gap: var(--hx-space-16);
		min-width: 0;
		padding: var(--hx-space-16);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius);
		background: var(--hx-color-surface);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--hx-space-8);
	}
	h2 {
		margin: 0;
		font-size: var(--hx-type-size-lg);
	}
	small {
		color: var(--hx-color-text-muted);
	}
</style>
