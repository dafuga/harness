import type { Check, Status } from '../../../../src/models/reports-media/Report.types';
import type { PreviewCases } from './shared';

/** A fictional checkout run supplies one complete check for the default preview. */
export const reportCheck: Check = {
	id: 'checkout',
	title: 'Checkout confirmation',
	status: 'passed',
	group: 'Browser checks · Chromium',
	counts: { passed: 12, failed: 0 },
	command: 'bun run test:e2e -- checkout.spec.ts',
	output: '12 passed (8.4s)'
};

const states: Status[] = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

/** Supply the component's empty, embedded, diagnostic and outcome presentations. */
export function reportChecksVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'empty') return { ...props, checks: [] };
	if (variant === 'embedded-empty') return { ...props, checks: [], embedded: true };
	if (variant === 'embedded' || variant === 'embedded-details-open')
		return { ...props, embedded: true };
	if (variant === 'minimal')
		return {
			...props,
			checks: [{ id: 'checkout', title: 'Checkout confirmation', status: 'passed' }]
		};
	if (variant === 'command-open')
		return { ...props, checks: [{ ...reportCheck, output: undefined }] };
	if (variant === 'output-open')
		return { ...props, checks: [{ ...reportCheck, command: undefined }] };
	if (variant === 'multiple')
		return {
			...props,
			checks: [
				reportCheck,
				{ id: 'refund', title: 'Refund receipt', status: 'failed', group: 'Browser checks' },
				{ id: 'mobile', title: 'Mobile checkout', status: 'running', group: 'Browser checks' }
			]
		};
	if (states.includes(variant as Status))
		return {
			...props,
			checks: [
				{ id: 'checkout', title: 'Checkout confirmation', status: variant, group: 'Browser checks' }
			]
		};
	return props;
}
