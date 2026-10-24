<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Report } from '../../../models/reports-media/Report.types';
	import { t } from '../../../utils/reports-media/reportLocale';
	import { dateLabel } from './reportDisplay';
	import { reportStale } from '../../../utils/reports-media/reportDisplay';
	import StatusBadge from '../../shared-primitives/StatusBadge.svelte';
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

<hx-header class="report-intro">
	<hx-div class="eyebrow">{report.project.name} <hx-span>/</hx-span> {$t(report.mode)}</hx-div>
	<hx-div class="title-row">
		<hx-h1>{report.title}</hx-h1>
		<StatusBadge status={report.status} />
	</hx-div>
	<hx-p class="lead">{report.summary}</hx-p>
	<hx-div class:has-gaps={gaps > 0} class="outcome-strip">
		<hx-strong>{$t('conclusion')}</hx-strong><hx-span class="outcome-value"
			>{$t('checksPassed', {
				values: {
					passed: report.checks.filter((item) => item.status === 'passed').length,
					total: report.checks.length
				}
			})}</hx-span
		>
		<hx-span class="outcome-value gap-count"
			>{$t('gapsCount', { values: { count: gaps } })} <hx-small>{$t('openGaps')}</hx-small></hx-span
		>
		<hx-span class="outcome-state"
			>{report.state === 'finalized' ? $t('finalized') : $t('active')}</hx-span
		>
	</hx-div>
	{#if report.historical}<hx-p class="notice">{$t('historicalNote')}</hx-p>{/if}
	{#if reportStale(report)}<hx-p class="notice">{$t('stale')}</hx-p>{/if}
	{#if report.state === 'finalizing'}<hx-p class="notice">{$t('finalizingNote')}</hx-p>{/if}
	<hx-div class="toolbar report-actions">
		{#if report.exports}
			<hx-a class="button primary" href={downloadBase + report.exports.pdf} download
				>{$t('pdf')} ↗</hx-a
			>
		{:else}<hx-span class="notice">{$t('exportsPending')}</hx-span>{/if}
		<hx-details class="run-details" bind:open={runOpen}>
			<hx-summary>
				<hx-span>{$t('runDetails')}</hx-span>
				{#if !report.revision}<StatusBadge status="not-proven" />{/if}
				<hx-span class="review-launch-count" aria-hidden="true">{runOpen ? '▴' : '▾'}</hx-span>
			</hx-summary>
			<hx-div class="panel run-details-body">
				<hx-div class="metadata">
					<hx-div
						><hx-span>{$t('environment')}</hx-span><hx-strong>{report.environment}</hx-strong
						></hx-div
					>
					<hx-div>
						<hx-span>{$t('revision')}</hx-span>{#if report.revision}<hx-code
								>{report.revision}</hx-code
							>{:else}<StatusBadge status="not-proven" />{/if}
					</hx-div>
					<hx-div
						><hx-span>{$t('updated')}</hx-span><hx-strong>{dateLabel(report.updatedAt)}</hx-strong
						></hx-div
					>
				</hx-div>
				{#if report.exports && !portable}
					<hx-div class="toolbar downloads">
						<hx-a class="button" href={downloadBase + report.exports.zip} download
							>{$t('zip')} ↓</hx-a
						>
						<hx-a class="button" href={downloadBase + report.exports.html} download
							>{$t('html')}</hx-a
						>
					</hx-div>
				{/if}
			</hx-div>
		</hx-details>
	</hx-div>
</hx-header>
