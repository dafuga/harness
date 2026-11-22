import { test } from 'vitest';
import { compareE2eTests, declaredE2eTests } from '../../scripts/check-e2e-list';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * declaredE2eTests and compareE2eTests are called the way main calls them: with the text of a
 * package script, and with lists of E2E paths. Neither reads a file, so no temporary folder is
 * needed. main is not exported, so it is not called here.
 */

const login = 'test/auth/login.e2e.test.ts';
const cart = 'test/checkout/cart.e2e.test.ts';
const orders = 'test/api/orders.e2e.test.ts';
const rootLogin = 'test/login.e2e.test.ts';
const removed = 'test/legacy/removed.e2e.test.ts';
const unitTest = 'test/unit/math.test.ts';

test('declaredE2eTests lists the E2E files a script names', () => {
	const reordered = [cart, login, cart].join(' ');
	const withUnitTest = [login, unitTest].join(' ');
	const semicolon = `vitest run ${login}; node ${orders}`;
	const noE2e = `vitest run ${unitTest}`;
	const listed = declaredE2eTests(reordered);
	const onlyE2e = declaredE2eTests(withUnitTest);
	const afterSemicolon = declaredE2eTests(semicolon);
	const none = declaredE2eTests(noE2e);
	expect(listed).toEqual([login, cart, cart]);
	expect(onlyE2e).toEqual([login]);
	expect(afterSemicolon).toEqual([orders]);
	expect(none).toEqual([]);
	recordExampleCases(
		{
			unitId: 'script.check-e2e-list',
			symbol: 'declaredE2eTests',
			state: 'declarede2etests-lists-the-e2e-files-a-script-names',
			evidence: 'examples-cases',
			file: 'declarede2etests-lists-the-e2e-files-a-script-names.json'
		},
		[
			{
				name: 'two E2E paths out of order, one repeated: sorted, and the repeat is kept',
				input: { script: reordered },
				output: listed
			},
			{
				name: 'an E2E path beside a unit test file: only the E2E path is listed',
				input: { script: withUnitTest },
				output: onlyE2e
			},
			{
				name: 'a path followed by a semicolon is skipped and the path at the end is listed',
				input: { script: semicolon },
				output: afterSemicolon
			},
			{
				name: 'a script that names no E2E file gives an empty list',
				input: { script: noE2e },
				output: none
			}
		]
	);
});

test('compareE2eTests reports missing and stale E2E files', () => {
	const mismatch = compareE2eTests([login, cart], [login, removed]);
	const sameInOtherOrder = compareE2eTests([login, cart], [cart, login]);
	const disk = [cart, orders, rootLogin, orders];
	const duplicates = compareE2eTests(disk, [cart]);
	const declaredTwice = [login, removed, removed];
	const repeatedStale = compareE2eTests([login], declaredTwice);
	expect(mismatch).toEqual({ missing: [cart], stale: [removed] });
	expect(sameInOtherOrder).toEqual({ missing: [], stale: [] });
	expect(duplicates).toEqual({ missing: [orders, rootLogin], stale: [] });
	expect(repeatedStale).toEqual({ missing: [], stale: [removed] });
	recordExampleCases(
		{
			unitId: 'script.check-e2e-list',
			symbol: 'compareE2eTests',
			state: 'comparee2etests-reports-missing-and-stale-e2e-files',
			evidence: 'examples-cases',
			file: 'comparee2etests-reports-missing-and-stale-e2e-files.json'
		},
		[
			{
				name: 'a file the scripts do not declare and a declared path that is not on disk',
				input: { actualFiles: [login, cart], declaredFiles: [login, removed] },
				output: mismatch
			},
			{
				name: 'the same two paths in another order: both lists are empty',
				input: { actualFiles: [login, cart], declaredFiles: [cart, login] },
				output: sameInOtherOrder
			},
			{
				name: 'a disk path listed twice and out of order: each missing path is listed once',
				input: { actualFiles: disk, declaredFiles: [cart] },
				output: duplicates
			},
			{
				name: 'a stale script path listed twice: it is listed once in stale',
				input: { actualFiles: [login], declaredFiles: declaredTwice },
				output: repeatedStale
			}
		]
	);
});
