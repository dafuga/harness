import type { BrowserDiagnostic } from '../../../../../../src/core/browserDiagnostics';
import type { PreviewCases } from './shared';

export const browserErrorsStates = [
	'expected-open',
	'unexpected',
	'exception',
	'missing-expected',
	'multiple',
	'zero-entries'
];

const unexpected: BrowserDiagnostic = {
	test: 'Checkout confirmation',
	file: 'checkout.spec.ts',
	project: 'Chromium',
	retry: 1,
	errors: [
		{
			type: 'console',
			message: 'Checkout summary could not be loaded',
			page: '/checkout',
			source: 'checkout.ts',
			line: 41,
			column: 8
		}
	],
	expected: []
};
const exception: BrowserDiagnostic = {
	...unexpected,
	test: 'Receipt after payment',
	project: '',
	browser: 'WebKit',
	errors: [
		{
			type: 'pageerror',
			message: 'Receipt is unavailable',
			page: '/receipt',
			stack: 'Error: Receipt is unavailable\n    at loadReceipt (receipt.ts:18:3)'
		}
	]
};

/** Supply recorded attempts for each visible diagnostic classification. */
export function browserErrorsVariant(props: PreviewCases[string], variant: string) {
	const expected = (props.diagnostics as BrowserDiagnostic[])[0];
	if (variant === 'unexpected') return { ...props, diagnostics: [unexpected] };
	if (variant === 'exception') return { ...props, diagnostics: [exception] };
	if (variant === 'missing-expected')
		return { ...props, diagnostics: [{ ...expected, errors: [] }] };
	if (variant === 'multiple') return { ...props, diagnostics: [expected, unexpected] };
	if (variant === 'zero-entries')
		return { ...props, diagnostics: [{ ...expected, errors: [], expected: [] }] };
	return props;
}
