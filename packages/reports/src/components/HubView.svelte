<script lang="ts">
	import BrandMark from './BrandMark.svelte';
	import type { Report } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import { dateLabel, reportStale } from '../utils/reportDisplay';
	import { evidenceMedia } from '../utils/evidenceMedia';
	import { projectFilter } from '../utils/reportFilter';
	import Select from './Select.svelte';
	import StatusBadge from './StatusBadge.svelte';
	let {
		reports,
		site = ''
	}: {
		reports: Report[];
		/** The application these reports belong to; the server sends no other's. */
		site?: string;
	} = $props();
	let search = $state(''),
		status = $state(''),
		mode = $state('');
	let filtered = $derived(
		reports.filter(
			(run) =>
				projectFilter(run, search, '') &&
				(!status || (status === 'interrupted' ? reportStale(run) : run.status === status)) &&
				(!mode || run.mode === mode)
		)
	);
	const audioCount = (run: Report) =>
		run.evidence.filter((item) => evidenceMedia(item) === 'audio').length;
	let audioTotal = $derived(reports.reduce((sum, run) => sum + audioCount(run), 0));
	let screenshotTotal = $derived(
		reports.reduce((sum, run) => sum + run.evidence.length, 0) - audioTotal
	);
	// Screenshot-only runs keep their original footer text; audio is counted beside it, never as screenshots.
	function mediaSummary(run: Report) {
		const audio = audioCount(run),
			images = run.evidence.length - audio;
		const shots = images
			? $t('screenshotsCount', { values: { count: images } })
			: $t('noScreenshots');
		if (!audio) return shots;
		const clips = $t('audioCount', { values: { count: audio } });
		return images ? shots + ' · ' + clips : clips;
	}
</script>

<main class="report-shell">
	<nav class="topbar">
		<a href="/harness/reports" class="brand"><span class="brand-symbol"><BrandMark /></span> {$t('hub')}</a>
		<a class="text-link" href="/harness/analytics">Harness Analytics</a>
		<a class="text-link" href="/harness">Harness console</a>
		<span class="workspace-label">{$t('local')}</span>
	</nav>
	<header class="hub-intro">
		<div class="eyebrow">{site ? `Reports of ${site}` : $t('history')}</div>
		<h1>{$t('hub')}</h1>
		<p class="lead">{$t('subtitle')}</p>
		<div class="hub-stats">
			<span><strong>{reports.length}</strong> {$t('runs')}</span><span
				><strong>{screenshotTotal}</strong> {$t('screenshots')}</span
			>{#if audioTotal}<span><strong>{audioTotal}</strong> {$t('audioClips')}</span>{/if}<span
				><strong
					>{reports.reduce(
						(sum, run) =>
							sum +
							run.coverage.filter((item) => item.status === 'blocked' || item.status === 'failed')
								.length +
							run.findings.filter((item) => item.status === 'blocked' || item.status === 'failed')
								.length,
						0
					)}</strong
				>
				{$t('openGaps')}</span
			>
		</div>
	</header>
	<div class="toolbar hub-filters">
		<input bind:value={search} placeholder={$t('search')} aria-label={$t('search')} />
		<Select bind:value={status} label={$t('status')}
			><option value="">{$t('status')}: {$t('all')}</option
			>{#each ['running', 'passed', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'] as s}<option
					value={s}>{$t(s)}</option
				>{/each}</Select
		>
		<Select bind:value={mode} label={$t('modes')}
			><option value="">{$t('allModes')}</option><option value="feature">{$t('feature')}</option
			><option value="suite">{$t('suite')}</option></Select
		>
	</div>
	<div class="run-grid">
		{#each filtered as run (run.id)}
			<a class="run-card" href={'/harness/reports/' + run.id}>
				<div class="card-kicker">
					<span>{$t(run.mode)}</span><StatusBadge status={run.status} />
				</div>
				<h2>{run.title}</h2>
				{#if reportStale(run)}
					<p class="run-liveness">
						Recorded as {$t(run.status).toLowerCase()}; no update since {dateLabel(run.updatedAt)}.
					</p>
				{/if}
				<p>{run.summary}</p>
				<div class="evidence-meta">
					<span>{$t(run.mode)}</span><span>{run.environment}</span>{#if run.historical}<span
							>{$t('historical')}</span
						>{/if}
				</div>
				<div class="run-footer">
					<span class:missing-count={!run.evidence.length}
						>{mediaSummary(run)} · {$t('checksCount', { values: { count: run.checks.length } })} · {$t(
							'gapsCount',
							{
								values: {
									count:
										run.coverage.filter(
											(item) => item.status === 'blocked' || item.status === 'failed'
										).length +
										run.findings.filter(
											(item) => item.status === 'blocked' || item.status === 'failed'
										).length
								}
							}
						)}</span
					><time>{dateLabel(run.startedAt)}</time>
				</div>
			</a>
		{/each}
	</div>
	{#if !filtered.length}<p class="empty">{$t('noReports')}</p>{/if}
</main>
