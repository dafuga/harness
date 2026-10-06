<script lang="ts">
	import type { Report } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import { reportDisplay, dateLabel } from '../utils/reportDisplay';
	import StatusBadge from './StatusBadge.svelte';
	let {
		report,
		downloadBase,
		portable = false
	}: { report: Report; downloadBase: string; portable?: boolean } = $props();
	let gaps = $derived(
		report.findings.filter((item) => ['failed', 'blocked', 'not-proven'].includes(item.status))
			.length +
			report.coverage.filter((item) => ['failed', 'blocked', 'not-proven'].includes(item.status))
				.length +
			(report.revision ? 0 : 1)
	);
	let runOpen = $state(false);
</script>

<header class="report-intro">
	<div class="eyebrow">{report.project.name} <span>/</span> {$t(report.mode)}</div>
	<div class="title-row">
		<h1>{report.title}</h1>
		<StatusBadge status={reportDisplay(report)} />
	</div>
	<p class="lead">{report.summary}</p>
	<div class:has-gaps={gaps > 0} class="outcome-strip">
		<strong>{$t('conclusion')}</strong><span class="outcome-value"
			>{$t('checksPassed', {
				values: {
					passed: report.checks.filter((item) => item.status === 'passed').length,
					total: report.checks.length
				}
			})}</span
		>
		<span class="outcome-value gap-count"
			>{$t('gapsCount', { values: { count: gaps } })} <small>{$t('openGaps')}</small></span
		>
		<span class="outcome-state"
			>{report.state === 'finalized' ? $t('finalized') : $t('active')}</span
		>
	</div>
	{#if report.historical}<p class="notice">{$t('historicalNote')}</p>{/if}
	{#if reportDisplay(report) === 'interrupted'}<p class="notice">{$t('stale')}</p>{/if}
	{#if report.state === 'finalizing'}<p class="notice">{$t('finalizingNote')}</p>{/if}
	<div class="toolbar report-actions">
		{#if report.exports}
			<a class="button primary" href={downloadBase + report.exports.pdf} download>{$t('pdf')} ↗</a>
		{:else}<span class="notice">{$t('exportsPending')}</span>{/if}
		<details class="run-details" bind:open={runOpen}>
			<summary>
				<span>{$t('runDetails')}</span>
				{#if !report.revision}<StatusBadge status="not-proven" />{/if}
				<span class="review-launch-count" aria-hidden="true">{runOpen ? '▴' : '▾'}</span>
			</summary>
			<div class="panel run-details-body">
				<div class="metadata">
					<div><span>{$t('environment')}</span><strong>{report.environment}</strong></div>
					<div>
						<span>{$t('revision')}</span>{#if report.revision}<code>{report.revision}</code
							>{:else}<StatusBadge status="not-proven" />{/if}
					</div>
					<div><span>{$t('updated')}</span><strong>{dateLabel(report.updatedAt)}</strong></div>
				</div>
				{#if report.exports && !portable}
					<div class="toolbar downloads">
						<a class="button" href={downloadBase + report.exports.zip} download>{$t('zip')} ↓</a>
						<a class="button" href={downloadBase + report.exports.html} download>{$t('html')}</a>
					</div>
				{/if}
			</div>
		</details>
	</div>
</header>
