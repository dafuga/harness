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

const outcomes: Status[] = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

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
	if (outcomes.includes(variant as Status))
		return {
			...props,
			section,
			embedded,
			report: { ...base, coverage: [{ ...base.coverage[0], status: variant as Status }] }
		};
	return { ...props, section, embedded };
}
