import type { Report } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';
import { evidenceGridItems } from './evidenceGridData';
import { reportCheck } from './reportChecksVariants';
import { reportSummaryFixture, reportSummaryVariant } from './reportSummaryVariants';

/** A complete checkout report for the report-view organism. */
export const reportViewFixture: Report = {
	...reportSummaryFixture,
	checks: [reportCheck, { id: 'mobile', title: 'Mobile checkout', status: 'passed' }],
	evidence: evidenceGridItems,
	findings: [
		{
			id: 'keyboard',
			title: 'Keyboard navigation review',
			detail: 'The checkout controls remain usable with the keyboard.',
			status: 'passed',
			evidenceIds: ['checkout-confirmation']
		}
	],
	acceptance: ['Complete checkout on desktop.', 'Confirm the receipt on mobile.']
};

/** Use the same lifecycle inputs as the summary and the real gallery controls. */
export function reportViewVariant(props: PreviewCases[string], variant: string) {
	const report = props.report as Report;
	if (variant === 'empty')
		return {
			...props,
			report: {
				...report,
				state: 'active',
				status: 'not-proven',
				revision: undefined,
				exports: undefined,
				checks: [],
				findings: [],
				acceptance: [],
				coverage: [],
				evidence: []
			}
		};
	if (variant === 'portable') return { ...props, portable: true };
	if (variant === 'image-open')
		return {
			...props,
			report: {
				...report,
				evidence: report.evidence.map((item) =>
					item.id === 'checkout-confirmation'
						? { ...item, provenance: item.provenance?.slice(0, 1) }
						: item
				)
			}
		};
	if (variant.startsWith('upload-'))
		return { ...props, report: { ...report, state: 'active', exports: undefined } };
	return reportSummaryVariant(props, variant);
}
