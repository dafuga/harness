import type { Report, Status } from '../../../../src/models/reports-media/Report.types';
import { report } from './reportData';
import type { PreviewCases } from './shared';

/** A fictional release review with concrete acceptance and coverage records. */
export const coverageListFixture: Report = {
	...report,
	acceptance: [
		'The customer sees an order confirmation after checkout.',
		'The receipt remains readable on desktop and mobile.'
	],
	coverage: [
		{
			id: 'desktop-checkout',
			title: 'Checkout confirmation',
			status: 'passed',
			viewport: 'Desktop · Chromium',
			detail: 'The order number and total match the completed purchase.'
		},
		{
			id: 'mobile-receipt',
			title: 'Mobile receipt',
			status: 'passed',
			viewport: 'Mobile · Chromium',
			detail: 'The receipt fits the viewport without horizontal scrolling.'
		}
	]
};

/** Section, embedding, empty-data and result presentations. */
export const coverageListStates = [
	'acceptance',
	'coverage',
	'embedded',
	'embedded-acceptance',
	'embedded-coverage',
	'empty',
	'acceptance-empty',
	'coverage-empty',
	'embedded-empty',
	'embedded-acceptance-empty',
	'embedded-coverage-empty',
	'minimal',
	'running',
	'failed',
	'blocked',
	'skipped',
	'not-proven',
	'interrupted'
];

const outcomeDetails: Partial<Record<Status, string>> = {
	running: 'Checking the displayed order number and total.',
	failed: 'The displayed total did not match the completed purchase.',
	blocked: 'The checkout environment was unavailable.',
	skipped: 'The checkout flow was outside this run’s scope.',
	'not-proven': 'No confirmation evidence was recorded.',
	interrupted: 'The run ended before the confirmation was checked.'
};

/** Keep each example to one component with its actual input shape. */
export function coverageListVariant(props: PreviewCases[string], variant: string) {
	const base = props.report as Report;
	const section = variant.includes('acceptance')
		? 'acceptance'
		: variant.includes('coverage')
			? 'coverage'
			: 'all';
	const embedded = variant.startsWith('embedded');
	if (variant.endsWith('empty'))
		return { ...props, section, embedded, report: { ...base, acceptance: [], coverage: [] } };
	if (variant === 'minimal')
		return {
			...props,
			section,
			embedded,
			report: { ...base, coverage: [{ id: 'checkout', title: 'Checkout', status: 'passed' }] }
		};
	const detail = outcomeDetails[variant as Status];
	if (detail)
		return {
			...props,
			section,
			embedded,
			report: { ...base, coverage: [{ ...base.coverage[0], status: variant as Status, detail }] }
		};
	return { ...props, section, embedded };
}
