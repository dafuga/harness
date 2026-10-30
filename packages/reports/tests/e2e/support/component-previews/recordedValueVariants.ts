import type { PreviewCases } from './shared';

/** Fictional observed checkout data for the default value presentation. */
export const recordedValueFixture = {
	status: 'passed',
	order: { id: 'A-1048', total: 128, currency: 'USD' },
	checks: ['Payment accepted', 'Receipt displayed']
};

/** Each displayed value shape or shortening message has its own catalog example. */
export const recordedValueStates = [
	'text',
	'number',
	'boolean',
	'null',
	'absent',
	'empty-text',
	'empty-list',
	'empty-object',
	'list',
	'mixed-list',
	'table',
	'long-text',
	'many-fields',
	'many-items',
	'many-rows',
	'deep',
	'custom-label',
	'field-empty',
	'bigint',
	'symbol',
	'callable',
	'error'
];

const longText =
	'The checkout confirmation includes the order number and delivery estimate. '.repeat(5);
const rows = Array.from({ length: 14 }, (_, index) => ({
	attempt: index + 1,
	viewport: index % 2 ? 'Mobile' : 'Desktop',
	result: index === 1 ? 'blocked' : 'passed'
}));

/** Supply realistic scalar, collection and limited-depth inputs. */
export function recordedValueVariant(props: PreviewCases[string], variant: string) {
	const values: Record<string, unknown> = {
		text: 'Checkout completed',
		number: 128,
		boolean: false,
		null: null,
		absent: undefined,
		'empty-text': '',
		'empty-list': [],
		'empty-object': {},
		list: ['Chromium', 'Firefox', 'WebKit'],
		'mixed-list': ['Receipt shown', { step: 'Payment', passed: true }, null],
		table: [
			{ viewport: 'Desktop', result: 'passed', durationMs: 840 },
			{ viewport: 'Mobile', result: 'passed', durationMs: 960 },
			{ viewport: 'Tablet', result: 'blocked' }
		],
		'long-text': longText,
		'many-fields': Object.fromEntries(
			Array.from({ length: 14 }, (_, index) => [`check${index + 1}`, 'passed'])
		),
		'many-items': Array.from({ length: 14 }, (_, index) => `Check ${index + 1}`),
		'many-rows': rows,
		deep: { run: { response: { order: { receipt: { id: 'A-1048' } } } } },
		'custom-label': longText,
		'field-empty': { '': 'Imported value without a field name' },
		bigint: BigInt(1048),
		symbol: Symbol('orderId'),
		callable: () => 'complete',
		error: {
			type: 'Error',
			message: 'Receipt service returned HTTP 503',
			code: 'SERVICE_UNAVAILABLE'
		}
	};
	return {
		...props,
		value: values[variant],
		...(variant === 'custom-label' ? { fullValuesLabel: 'Captured input' } : {})
	};
}
