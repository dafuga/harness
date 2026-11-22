<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_lulgtb22gp -->
<script lang="ts">
	import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		providerNames,
		relativeWhen,
		quotaReset,
		staleReading,
		usageLinks,
		warningFor,
		warningLabel
	} from './hubHomePresentation';
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
	const warnings = $derived(
		subscription.limits.filter((limit) => warningFor(limit.left) === 'critical')
	);
</script>

<hx-section
	class={detailed ? 'po-card hh-q-plan' : 'hh-q-sub'}
	aria-label={providerNames[subscription.provider]}
>
	<hx-header class="hh-q-sub-head">
		<hx-div class="hh-q-identity">
			<hx-h3 class="hh-q-provider">{providerNames[subscription.provider]}</hx-h3>
			<hx-p class="po-sessions"
				>{[
					subscription.plan,
					subscription.account,
					`read ${relativeWhen(subscription.readAt, now)}`
				]
					.filter(Boolean)
					.join(' · ')}</hx-p
			>
		</hx-div>
		{#if stale}<hx-span class="hh-q-stale">Stale</hx-span>{/if}
	</hx-header>
	{#each warnings as limit (limit.id)}
		<hx-p class="hh-q-callout" data-level="critical"
			><hx-strong>Almost out</hx-strong> · {limit.label} · {limit.left}% left · {quotaReset(
				limit.resetsAt,
				now
			)}</hx-p
		>
	{/each}
	<hx-div class={detailed ? 'hh-q-panel-grid' : ''}>
		<hx-div class="hh-q-meters">
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
			{#if subscription.credits}<hx-p class="hh-q-credits"
					>Credits <hx-strong>{subscription.credits}</hx-strong></hx-p
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
				{:else}<hx-p class="po-sessions">No usage history yet.</hx-p>{/if}
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
	{#if detailed}
		<hx-div class="po-callout-actions">
			<hx-time class="po-sessions" datetime={subscription.readAt}
				>Read {new Date(subscription.readAt).toLocaleString()}</hx-time
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
