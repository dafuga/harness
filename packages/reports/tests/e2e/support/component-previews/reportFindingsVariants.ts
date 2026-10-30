import type { Finding, Status } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';

const descriptions: Partial<Record<Status, string>> = {
	running: 'Checking keyboard navigation through the checkout controls.',
	failed: 'The confirmation button cannot be reached with the keyboard.',
	blocked: 'The checkout environment was unavailable for keyboard review.',
	skipped: 'Keyboard review was outside this run’s scope.',
	'not-proven': 'No keyboard review evidence was retained.',
	interrupted: 'The run ended before keyboard navigation was checked.'
};

/** Show recorded findings, evidence links and each result with consistent descriptions. */
export function reportFindingsVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, findings: [] };
	const base = (props.findings as Finding[])[0];
	if (variant === 'with-evidence')
		return { ...props, findings: [{ ...base, evidenceIds: ['checkout-confirmation'] }] };
	if (variant === 'multiple')
		return {
			...props,
			findings: [
				{ ...base, evidenceIds: ['checkout-confirmation'] },
				{
					id: 'receipt',
					title: 'Receipt total differs',
					detail: 'The mobile receipt total did not match the order.',
					status: 'failed',
					evidenceIds: ['mobile-receipt']
				}
			]
		};
	const detail = descriptions[variant as Status];
	return detail
		? {
				...props,
				findings: [
					{ ...base, title: 'Keyboard navigation review', status: variant as Status, detail }
				]
			}
		: props;
}
