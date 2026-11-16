import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { mintUid } from '../../src/workflows/development-tooling/backfill-uids/mintUid';

const unitId = 'workflow.development-tooling-backfill-uids-mint-uid';
const uidShape = /^u_[a-z2-7]{10}$/;
const seeded = ['u_k3qz7wd2hv', 'u_bq6t2mxr4a'];

test('Mints a fresh uid and records it in the taken set', () => {
	const taken = new Set<string>();
	const uid = mintUid(taken);

	expect(uid).toMatch(uidShape);
	expect(taken.has(uid)).toBe(true);
	expect(taken.size).toBe(1);
	recordExampleCases(
		{
			unitId,
			symbol: 'mintUid',
			state: 'mints-a-fresh-uid-and-records-it-in-the-taken-set',
			evidence: 'examples-cases',
			file: 'mints-a-fresh-uid-and-records-it-in-the-taken-set.json'
		},
		[
			{
				name: 'empty taken set yields one new uid that is recorded in the set',
				input: { taken: [] },
				output: { uid, takenSize: taken.size }
			}
		]
	);
});

test('Skips uids already held in the taken set', () => {
	const taken = new Set<string>(seeded);
	const minted = [mintUid(taken), mintUid(taken), mintUid(taken)];

	for (const uid of minted) {
		expect(uid).toMatch(uidShape);
		expect(seeded).not.toContain(uid);
	}
	expect(new Set(minted).size).toBe(3);
	expect(taken.size).toBe(5);
	recordExampleCases(
		{
			unitId,
			symbol: 'mintUid',
			state: 'skips-uids-already-held-in-the-taken-set',
			evidence: 'examples-cases',
			file: 'skips-uids-already-held-in-the-taken-set.json'
		},
		[
			{
				name: 'three calls sharing a taken set with two seeded uids return three new distinct uids',
				input: { taken: seeded },
				output: { minted, takenSize: taken.size }
			}
		]
	);
});
