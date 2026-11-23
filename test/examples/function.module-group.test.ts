import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	modulePath,
	moduleGroup,
	matchingGroups
} from '../../src/utils/development-tooling/moduleGroup';

const groups = [
	{ id: 'billing', title: 'Billing', terms: ['invoice', 'payment'] },
	{
		id: 'pricing',
		title: 'Pricing',
		terms: ['plan', 'checkout'],
		folders: ['apps/web/src/routes/(pricing-plans)/']
	},
	{
		id: 'account-settings',
		title: 'Account settings',
		terms: ['profile', 'security'],
		folders: ['apps/web/src/routes/(account)/']
	}
];

test('Resolves module paths', () => {
	const paths = [
		'src/components/billing/InvoiceTable.tsx',
		'packages/web/src/lib/utils/billing/formatCurrency.ts',
		'apps/admin/src/app/(marketing)/pricing/page.tsx',
		'src/unknown/billing/file.ts'
	];
	const outputs = paths.map(modulePath);
	expect(outputs).toEqual([
		{ root: 'src/components', parts: ['billing', 'InvoiceTable.tsx'] },
		{ root: 'packages/web/src/lib/utils', parts: ['billing', 'formatCurrency.ts'] },
		{ root: 'apps/admin/src/app', parts: ['(marketing)', 'pricing', 'page.tsx'] },
		undefined
	]);
	recordExampleCases(
		{
			unitId: 'function.module-group',
			symbol: 'modulePath',
			state: 'resolves-module-paths',
			evidence: 'examples-cases',
			file: 'resolves-module-paths.json'
		},
		paths.map((input, index) => ({ name: input, input, output: outputs[index] }))
	);
});

test('Resolves owned categories', () => {
	const inputs = [
		['src/components/billing/InvoiceTable.tsx', 'src/components/billing/InvoiceRow.tsx'],
		['apps/web/src/routes/(pricing-plans)/index.tsx'],
		['apps/web/src/routes/(account)/profile.tsx'],
		['src/components/billing/InvoiceTable.tsx', 'src/routes/pricing/checkout.tsx']
	];
	const outputs = inputs.map((paths) => moduleGroup(paths, groups));
	expect(outputs).toEqual([
		{ id: 'billing', title: 'Billing' },
		{ id: 'pricing', title: 'Pricing' },
		{ id: 'account-settings', title: 'Account settings' },
		undefined
	]);
	recordExampleCases(
		{
			unitId: 'function.module-group',
			symbol: 'moduleGroup',
			state: 'resolves-owned-categories',
			evidence: 'examples-cases',
			file: 'resolves-owned-categories.json'
		},
		inputs.map((input, index) => ({
			name: `owned paths ${index + 1}`,
			input,
			output: outputs[index]
		}))
	);
});

test('Scores category matches', () => {
	const inputs = ['InvoiceTable', 'usePaymentRetry', 'InvoicePlanCard', 'billingCycle'];
	const outputs = inputs.map((text) =>
		matchingGroups(text, groups).map(({ id, title }) => ({ id, title }))
	);
	expect(outputs).toEqual([
		[{ id: 'billing', title: 'Billing' }],
		[{ id: 'billing', title: 'Billing' }],
		[
			{ id: 'billing', title: 'Billing' },
			{ id: 'pricing', title: 'Pricing' }
		],
		[{ id: 'billing', title: 'Billing' }]
	]);
	recordExampleCases(
		{
			unitId: 'function.module-group',
			symbol: 'matchingGroups',
			state: 'scores-category-matches',
			evidence: 'examples-cases',
			file: 'scores-category-matches.json'
		},
		inputs.map((input, index) => ({ name: input, input, output: outputs[index] }))
	);
});
