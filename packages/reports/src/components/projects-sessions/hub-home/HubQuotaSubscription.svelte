<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_lulgtb22gp -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		creditsLabel,
		providerNames,
		relativeWhen,
		quotaReset,
		staleReading,
		usageLinks,
		warningFor,
		warningLabel
	} from './hubHomePresentation';
	import { runMoment } from './hubHomeTime';
	let {
		subscription,
		now,
		detailed = false,
		reload
	}: {
		subscription: HomeSubscription;
		now: number;
		detailed?: boolean;
		reload?: () => void;
	} = $props();
	const stale = $derived(staleReading(subscription.readAt, now));
	const today = $derived(new Date(now).toISOString().slice(0, 10));
	const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
	const chartMax = $derived(
		Math.max(
			20,
			Math.ceil(Math.max(...subscription.history.map((reading) => reading.used)) / 20) * 20
		)
	);
	const worst = $derived(
		subscription.limits.filter((limit) => warningFor(limit.left)).sort((a, b) => a.left - b.left)[0]
	);
	const status = $derived(
		!worst
			? { tone: 'done', label: 'OK' }
			: warningFor(worst.left) === 'critical'
				? { tone: 'blocked', label: warningLabel(worst) }
				: { tone: 'needs-you', label: 'Low' }
	);
</script>

<hx-section
	class={detailed ? `po-card hh-q-plan ${stale ? '' : `po-${status.tone}`}` : 'hh-q-sub'}
	aria-label={providerNames[subscription.provider]}
>
	<hx-header class="hh-q-sub-head">
		<hx-div class="hh-q-identity">
			<hx-h3 class="hh-q-provider">{providerNames[subscription.provider]}</hx-h3>
			<hx-p class="po-sessions"
				>{[
					subscription.plan,
					subscription.account,
					stale ? null : `read ${relativeWhen(subscription.readAt, now)}`
				]
					.filter(Boolean)
					.join(' · ')}</hx-p
			>
		</hx-div>
		{#if stale}<hx-span class="hh-q-stale">Unknown</hx-span>
		{:else if detailed}<Pill tone={`hh-tone po-state po-${status.tone}`} state={status.tone}
				><hx-span class="po-mark" aria-hidden="true"></hx-span>{status.label}</Pill
			>{/if}
	</hx-header>
	{#if stale}
		<hx-p class="po-sessions">The last reading is out of date.</hx-p>
	{:else}
		{#if detailed && worst && warningFor(worst.left) === 'critical'}
			<hx-div class="po-callout hh-q-callout" data-kind="blocked" data-level="critical">
				<hx-div class="po-callout-head"
					><hx-span class="po-callout-label">{warningLabel(worst)}</hx-span><hx-span
						class="po-callout-meta">{quotaReset(worst.resetsAt, now)}</hx-span
					></hx-div
				>
				<hx-p class="po-callout-text">{worst.label}: {worst.left}% left.</hx-p>
			</hx-div>
		{/if}
		<hx-div class={detailed ? 'hh-q-panel-grid' : ''}>
			<hx-div class="hh-q-meters">
				{#if !subscription.limits.length}
					<hx-p class="po-sessions">Remaining quota is unknown.</hx-p>
				{/if}
				{#each subscription.limits as limit (limit.id)}
					{@const level = warningFor(limit.left)}
					<hx-div class="hh-q-meter" data-level={level ?? undefined}>
						<hx-div class="hh-q-line">
							<hx-span class="hh-q-label"
								>{limit.label}
								{#if level}<hx-span class="hh-q-flag" data-level={level}
										><hx-span class="hh-q-mark" aria-hidden="true"></hx-span>{warningLabel(
											limit
										)}</hx-span
									>{/if}
							</hx-span>
							<hx-span class="hh-q-value"><hx-strong>{limit.left}%</hx-strong> left</hx-span>
						</hx-div>
						<hx-div
							class="hh-q-bar"
							role="meter"
							aria-label={`${limit.label} remaining`}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={limit.left}
						>
							<hx-span style:width={`${limit.left}%`}></hx-span>
						</hx-div>
						<hx-div class="hh-q-line">
							<hx-span class="hh-q-reset">{quotaReset(limit.resetsAt, now)}</hx-span>
						</hx-div>
					</hx-div>
				{/each}
				{#if subscription.credits}<hx-div class="hh-q-line hh-q-credits"
						><hx-span class="hh-q-label">Credits</hx-span><hx-span class="hh-q-value"
							><hx-strong>{creditsLabel(subscription.credits)}</hx-strong></hx-span
						></hx-div
					>{/if}
			</hx-div>
			{#if detailed}
				<hx-div>
					<hx-h4 class="po-label">Weekly usage · Last 7 days</hx-h4>
					{#if subscription.history.length}
						<hx-div
							class="hh-q-chart"
							role="img"
							aria-label={subscription.history
								.map((reading) => `${reading.day}: ${reading.used}% used`)
								.join(', ')}
						>
							<hx-div class="hh-q-axis" aria-hidden="true">
								<hx-span>{chartMax}%</hx-span>
								<hx-span>{chartMax / 2}%</hx-span>
								<hx-span>0%</hx-span>
							</hx-div>
							<hx-div class="hh-q-series" aria-hidden="true">
								{#each subscription.history as reading (reading.day)}
									<hx-div class="hh-q-history-col" title={`${reading.day} · ${reading.used}% used`}>
										<hx-span style:height={`${(reading.used / chartMax) * 100}%`}></hx-span>
										<hx-time class="hh-q-day" datetime={reading.day}
											>{reading.day === today
												? 'Today'
												: weekday.format(new Date(reading.day))}</hx-time
										>
									</hx-div>
								{/each}
							</hx-div>
						</hx-div>
					{:else}<hx-p class="po-sessions">Usage history is unknown.</hx-p>{/if}
				</hx-div>
				<hx-div class="hh-q-agents">
					<hx-h4 class="po-label">Top agents this week</hx-h4>
					{#if !subscription.agents.length}<hx-p class="po-sessions"
							>No per-agent usage available.</hx-p
						>{/if}
					<hx-ul class="hh-q-top">
						{#each subscription.agents as agent (agent.name)}
							<hx-li class="hh-q-top-row"
								>{agent.name} <hx-span class="hh-q-top-value">{agent.description}</hx-span></hx-li
							>
						{/each}
					</hx-ul>
				</hx-div>
			{/if}
		</hx-div>
	{/if}
	{#if detailed}
		<hx-div class="po-callout-actions">
			<hx-time class="po-sessions" datetime={subscription.readAt}
				>Read {runMoment(subscription.readAt)}</hx-time
			>
			{#if stale && reload}<hx-button type="button" class="po-action" onclick={reload}
					>Read now</hx-button
				>{/if}
			<hx-a
				class="po-action"
				href={usageLinks[subscription.provider]}
				target="_blank"
				rel="noreferrer">Provider usage</hx-a
			>
		</hx-div>
	{/if}
</hx-section>
