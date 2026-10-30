import type { Report, Status } from '../../../../src/models/reports-media/Report.types';
import { report } from './reportData';
import type { PreviewCases } from './shared';

/** Fictional finalized checkout verification with its available exports. */
export const reportSummaryFixture: Report = {
	...report,
	project: { id: 'northstar', name: 'Northstar Store', path: '/northstar' },
	title: 'Checkout release verification',
	environment: 'Chromium · macOS',
	revision: '7c4a8d09e1b236fa7532cb8e462d1f975abc0031',
	summary: 'Review the checkout confirmation and receipt across desktop and mobile browsers.',
	checks: [
		{ id: 'desktop', title: 'Desktop checkout', status: 'passed' },
		{ id: 'mobile', title: 'Mobile checkout', status: 'passed' }
	],
	findings: [],
	coverage: [
		{ id: 'desktop', title: 'Checkout confirmation', status: 'passed', viewport: 'Desktop' },
		{ id: 'mobile', title: 'Checkout confirmation', status: 'passed', viewport: 'Mobile' }
	],
	exports: { pdf: 'checkout-report.pdf', html: 'checkout-report.html', zip: 'checkout-report.zip' }
};

/** Distinct lifecycle, provenance, result and download presentations. */
export const reportSummaryStates = [
	'run-open',
	'portable-open',
	'active',
	'active-open',
	'stale',
	'finalizing',
	'historical',
	'gaps',
	'no-revision',
	'no-revision-open',
	'no-checks',
	'suite',
	'running',
	'failed',
	'blocked',
	'skipped',
	'not-proven',
	'interrupted'
];

const outcomes: Status[] = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

/** Supply lifecycle and provenance inputs without changing the default report. */
export function reportSummaryVariant(props: PreviewCases[string], variant: string) {
	const base = props.report as Report;
	if (variant === 'portable-open') return { ...props, portable: true };
	const lifecycle = lifecycleReport(base, variant);
	if (lifecycle) return { ...props, report: lifecycle };
	if (variant === 'no-revision' || variant === 'no-revision-open')
		return { ...props, report: { ...base, revision: undefined } };
	if (variant === 'no-checks')
		return {
			...props,
			report: { ...base, checks: [], state: 'active', status: 'running', exports: undefined }
		};
	if (variant === 'suite') return { ...props, report: { ...base, mode: 'suite' } };
	if (outcomes.includes(variant as Status))
		return { ...props, report: outcomeReport(base, variant as Status) };
	return props;
}

function lifecycleReport(base: Report, variant: string): Report | null {
	if (variant === 'active' || variant === 'active-open')
		return { ...base, state: 'active', exports: undefined };
	if (variant === 'stale')
		return {
			...base,
			state: 'active',
			status: 'running',
			exports: undefined,
			updatedAt: '2026-10-20T09:30:00Z'
		};
	if (variant === 'finalizing') return { ...base, state: 'finalizing', exports: undefined };
	if (variant === 'historical') return { ...base, historical: true };
	if (variant === 'gaps')
		return {
			...base,
			status: 'failed',
			findings: [
				{
					id: 'receipt',
					title: 'Receipt review',
					detail: 'No receipt evidence was recorded.',
					status: 'not-proven'
				}
			],
			coverage: [{ id: 'mobile', title: 'Mobile checkout', viewport: 'Mobile', status: 'failed' }]
		};
	return null;
}

function outcomeReport(base: Report, status: Status): Report {
	const active = status === 'running' || status === 'interrupted';
	return {
		...base,
		status,
		state: active ? 'active' : 'finalized',
		exports: active ? undefined : base.exports,
		checks: [{ ...base.checks[0], status }, base.checks[1]],
		coverage: [{ ...base.coverage[0], status }, base.coverage[1]]
	};
}
