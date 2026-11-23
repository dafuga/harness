import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	unclassified,
	drawings,
	groupFor,
	groupTokens,
	assignRoles,
	sample,
	headingId
} from '../../src/components/explorer-ui/styleTokenGroups';

test('Groups style tokens and prepares their role specimens', () => {
	const tokens = [
		{ name: '--hx-color-primary', value: '#123456', resolved: '#123456', group: 'Colors' as const },
		{
			name: '--hx-color-primary-soft',
			value: 'color-mix(...)',
			resolved: '#abc',
			group: 'Colors' as const
		},
		{ name: '--hx-color-custom', value: '#abcdef', resolved: '#abcdef', group: 'Colors' as const },
		{ name: '--local-note', value: '7px', resolved: '7px', group: unclassified }
	];
	const grouped = groupTokens(tokens);
	const roleCards = assignRoles({
		name: 'Colors',
		description: 'Color roles',
		tokens: tokens.slice(0, 3)
	});
	const output = {
		colorGroup: groupFor('--hx-color-primary'),
		unknownGroup: groupFor('--local-note'),
		groups: grouped.map(({ name, tokens: rows }) => ({
			name,
			tokenNames: rows.map(({ name: tokenName }) => tokenName)
		})),
		roles: roleCards.map(({ name, sets }) => ({
			name,
			sets: sets.map(({ label, rows }) => ({ label, tokenNames: rows.map(({ name }) => name) }))
		})),
		drawing: drawings.find(([pattern]) => pattern.test('--hx-color-primary'))?.slice(1),
		numeralSample: sample('--hx-style-leading-tight'),
		textSample: sample('--hx-color-primary'),
		heading: headingId('Spacing & Corners')
	};

	expect(output).toMatchObject({
		colorGroup: 'Colors',
		unknownGroup: unclassified,
		numeralSample: '1111 8888\n0123 4567',
		textSample: 'Aa Bb 0123',
		heading: 'styles-group-spacing-corners'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-style-token-groups',
			symbol: 'groupTokens',
			state: 'groups-style-tokens-and-prepares-their-role-specimens',
			evidence: 'examples-cases',
			file: 'groups-style-tokens-and-prepares-their-role-specimens.json'
		},
		[
			{
				name: 'color choices, an unassigned color, and an unclassified token',
				input: { tokenNames: tokens.map(({ name }) => name) },
				output
			}
		]
	);
});
