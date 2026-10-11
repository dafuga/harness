<script lang="ts">
	import type { PageData } from './$types';
	import '../../../lib/styles/analytics.css';
	import AnalyticsCpu from '../../../components/AnalyticsCpu.svelte';
	import AnalyticsFilters from '../../../components/AnalyticsFilters.svelte';
	import AnalyticsHistory from '../../../components/AnalyticsHistory.svelte';
	import AnalyticsModels from '../../../components/AnalyticsModels.svelte';
	import AnalyticsTasks from '../../../components/AnalyticsTasks.svelte';
	import SiteActivity from '../../../components/SiteActivity.svelte';
	import { analyticsCount, analyticsDisplay } from '../../../utils/analyticsDisplay';
	type Check = PageData['analytics']['jev']['response'];
	let { data }: { data: PageData } = $props();
	let { summary, filters, loops, jev, models } = $derived(data.analytics);
	let scope = $derived(
		Object.values(filters).some(Boolean) ? 'Matching the applied filters' : 'All recorded history'
	);
	let overview = $derived([
		{ label: 'Events', value: summary.events, hint: 'Harness events recorded' },
		{ label: 'Loops', value: summary.loops, hint: 'Loops started' },
		{ label: 'Completed loops', value: summary.completedLoops, hint: 'Loops that finished' }
	]);
</script>

<svelte:head>
	<title>Harness Analytics</title>
</svelte:head>

{#snippet firstTry(label: string, testId: string, check: Check)}
	{@const tally = check.firstTry}
	<div class="analytics-card analytics-accent" data-testid={testId}>
		<h3 class="analytics-label">{label}</h3>
		<strong class="analytics-value" class:analytics-quiet={tally.rate === null}>
			{analyticsDisplay(tally.rate)}
		</strong>
		<span>{tally.numerator}/{tally.denominator} tasks passed on their first assessed check</span>
		<small>{analyticsCount(check.excluded)} excluded from this rate</small>
	</div>
{/snippet}

<main class="report-shell" data-harness-view="analytics">
	<nav class="topbar">
		<span class="brand"><span class="brand-symbol" aria-hidden="true">◈</span> Harness</span>
		<a class="text-link" href="/harness/reports">Project reports</a>
	</nav>
	<header class="analytics-intro">
		<div class="eyebrow">
			Analytics of {data.project?.activity.repository.name ?? 'this repository'}
		</div>
		<h1>Harness Analytics</h1>
		<p class="lead">
			What this repository is doing and has done: who is working in its checkouts, its loops, recent
			work, first-try quality and model usage. Only this repository and its checkouts are counted;
			the CPU figures further down are of this machine.
		</p>
	</header>
	{#if data.project}
		<SiteActivity shown={data.project} />
	{:else}
		<p class="notice analytics-alert" role="alert">
			The activity of this repository could not be read, so none is shown.
		</p>
	{/if}
	<AnalyticsFilters {filters} />
	<section class="analytics-section">
		<div class="analytics-heading">
			<h2>Overview</h2>
			<p class="analytics-note">{scope}</p>
		</div>
		<div class="analytics-grid analytics-tiles">
			{#each overview as item (item.label)}
				<div class="analytics-card">
					<span class="analytics-label">{item.label}</span>
					<strong class="analytics-value">{analyticsCount(item.value)}</strong>
					<small>{item.hint}</small>
				</div>
			{/each}
		</div>
	</section>
	<section class="analytics-section">
		<div class="analytics-heading">
			<h2>First-try quality</h2>
			<p class="analytics-note">Task-based, not a per-check pass rate</p>
		</div>
		<div class="analytics-grid analytics-pair">
			{@render firstTry('Response first try', 'response-first-try', jev.response)}
			{@render firstTry('Clean code first try', 'clean-code-first-try', jev.cleanCode)}
		</div>
		<p class="analytics-note">
			Each task counts once, by whether its first assessed check passed. Cached results, dry runs,
			incomplete runs and checks not linked to a task are excluded, because none gives a fresh
			verdict that can be attributed to an attempt.
		</p>
	</section>
	<AnalyticsCpu />
	<AnalyticsHistory {summary} {loops} />
	<AnalyticsModels {models} />
	<AnalyticsTasks {jev} />
</main>
