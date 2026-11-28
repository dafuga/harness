<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycw5bstr23 -->
<script lang="ts">
	import { tick } from 'svelte';
	import { compareOverviewMachines } from '$reports/lib/projects-sessions/project-overview/projectOverviewItems';
	import { waitAge } from '$reports/lib/projects-sessions/hub-home/waitAge';
	import { boardComputer, boardSessions } from './hubHomeBoardView';
	import { boardComputerName } from './hubHomeBoardText';
	import { providerNames, quotaReset, staleReading } from './hubHomePresentation';
	import HubHomeComputerDetail from './HubHomeComputerDetail.svelte';
	import type { HomeView, OpenHomeSection } from './hubHomeView.types';
	import type { HomeLiveOverview } from '$reports/lib/projects-sessions/hub-home/homeLive.types';

	let {
		view,
		live,
		open,
		showColumn
	}: {
		view: HomeView;
		live?: HomeLiveOverview;
		open: OpenHomeSection;
		showColumn: (column: 'progress' | 'blocked') => void;
	} = $props();
	const sessions = $derived(boardSessions(live));
	const oldest = $derived(view.openAsks.map((ask) => ask.since).sort()[0]);
	const machines = $derived((live?.machines ?? []).slice().sort(compareOverviewMachines));
	/** One headline limit per provider: Claude's shortest window, Codex's longest. */
	const quota = $derived(
		(['claude', 'codex'] as const).flatMap((provider) => {
			const subscription = view.quota?.find((entry) => entry.provider === provider);
			if (!subscription) return [];
			const wanted = provider === 'claude' ? /5|session/i : /week/i;
			const limit =
				subscription.limits.find((entry) => wanted.test(entry.label)) ?? subscription.limits[0];
			const stale = staleReading(subscription.readAt, view.now);
			return limit ? [{ provider, limit, stale }] : [];
		})
	);
	let chosen = $state<string>();
	let trigger: HTMLElement | undefined;
	const selected = $derived(machines.find((machine) => machine.name === chosen));
	function close() {
		const target = trigger;
		chosen = undefined;
		void tick().then(() => target?.focus());
	}
</script>

<hx-section class="hb-strip" aria-label="Overall numbers">
	<hx-button type="button" class="hb-stat" onclick={() => showColumn('progress')}>
		<hx-span class="hb-label"><hx-span class="hb-wide">Sessions running</hx-span></hx-span>
		<hx-strong class="hb-number">{live ? sessions.total : '–'}</hx-strong>
		<hx-span class="hb-sub hb-wide">{live ? sessions.detail : 'No computer answered'}</hx-span>
		<hx-span class="hb-sub hb-narrow">Sessions</hx-span>
	</hx-button>
	<hx-button
		type="button"
		class="hb-stat hb-stat-needs"
		data-needs={view.openAsks.length > 0 || undefined}
		onclick={() => showColumn('blocked')}
	>
		<hx-span class="hb-label"><hx-span class="hb-wide">Needs you</hx-span></hx-span>
		<hx-strong class="hb-number">{view.openAsks.length}</hx-strong>
		<hx-span class="hb-sub hb-wide"
			>{oldest ? `Oldest waiting ${waitAge(oldest, view.now)}` : 'Nothing waiting'}</hx-span
		>
		<hx-span class="hb-sub hb-narrow">Need you</hx-span>
	</hx-button>
	<hx-div class="hb-panel hb-computers">
		<hx-span class="hb-label hb-wide">Computers</hx-span>
		{#if machines.length}
			<hx-ul class="hb-meters" aria-label="Computers">
				{#each machines as machine (machine.name)}
					{@const state = boardComputer(machine, live)}
					<hx-li>
						<hx-button
							type="button"
							class="hb-meter hb-computer"
							data-state={state.status}
							aria-haspopup="dialog"
							onclick={(event) => {
								trigger = event.currentTarget;
								chosen = machine.name;
							}}
						>
							<hx-span class="hb-meter-head">
								<hx-span class="hb-mark" aria-hidden="true"></hx-span>
								<hx-strong>{boardComputerName(state.name)}</hx-strong>
								<hx-span class="hb-word hb-wide">{state.word}</hx-span>
							</hx-span>
							<hx-span class="hb-bar hb-wide" aria-hidden="true"
								><hx-span style:width={`${Math.min(state.load ?? 0, 100)}%`}></hx-span></hx-span
							>
							<hx-span class="hb-sub hb-wide">{state.detail}</hx-span>
							<hx-span class="hb-sub hb-narrow">{state.short}</hx-span>
						</hx-button>
					</hx-li>
				{/each}
			</hx-ul>
		{:else}<hx-p class="hb-sub">Computers appear when a linked Mac answers.</hx-p>{/if}
	</hx-div>
	<hx-button
		type="button"
		class="hb-panel hb-quota"
		aria-haspopup="dialog"
		aria-label="Quota details"
		onclick={() => open('quota')}
	>
		<hx-span class="hb-label hb-wide">Quota</hx-span>
		<hx-span class="hb-meters">
			{#each quota as { provider, limit, stale } (provider)}
				<hx-span class="hb-meter" data-low={limit.left <= 20 || undefined}>
					<hx-span class="hb-meter-head hb-wide"
						><hx-strong>{providerNames[provider]}</hx-strong>
						<hx-span>{limit.label.toLowerCase()}</hx-span></hx-span
					>
					<hx-strong class="hb-number hb-narrow">{limit.left}%</hx-strong>
					<hx-span class="hb-bar hb-wide" aria-hidden="true"
						><hx-span style:width={`${limit.left}%`}></hx-span></hx-span
					>
					<hx-span class="hb-sub hb-wide"
						>{limit.left}% left · {stale
							? 'old reading'
							: quotaReset(limit.resetsAt, view.now)}</hx-span
					>
					<hx-span class="hb-sub hb-narrow">{providerNames[provider]} left</hx-span>
				</hx-span>
			{:else}
				<hx-span class="hb-sub">{view.quota === null ? 'Reading usage…' : 'No readings'}</hx-span>
			{/each}
		</hx-span>
	</hx-button>
</hx-section>
{#if selected}<HubHomeComputerDetail machine={selected} {close} />{/if}
