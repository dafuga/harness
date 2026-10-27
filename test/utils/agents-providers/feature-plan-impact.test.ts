import { Command } from 'commander';
import { expect, test, vi } from 'vitest';
import {
	featurePlanImpact,
	registerFeaturePlanImpact
} from '../../../src/utils/agents-providers/featurePlanImpact';
import { data } from '../../validators/agents-providers/feature-plan-coverage.test.fixtures';

function fixture() {
	const metadata = data();
	metadata.relationships['component.shared'].pages = ['page.beta', 'page.alpha', 'page.beta'];
	const proposal = {
		sourceCommit: metadata.commit,
		changes: [
			{ unit: 'component.shared', kind: 'modify', assignedFiles: ['src/component.shared.ts'] },
			{
				unit: 'page.direct',
				kind: 'modify',
				assignedFiles: ['src/routes/page.direct/+page.svelte']
			}
		]
	};
	const readData = vi.fn(async () => metadata as never);
	return { metadata, proposal, readData };
}

test('featurePlanImpact discovers committed direct and consuming pages without mutation', async () => {
	const f = fixture();
	const before = structuredClone({ metadata: f.metadata, proposal: f.proposal });
	const result = await featurePlanImpact(f.proposal, { readData: f.readData });
	expect(result).toEqual({
		sourceCommit: f.proposal.sourceCommit,
		valid: true,
		affectedPages: ['page.alpha', 'page.beta', 'page.direct'],
		errors: []
	});
	expect(f.readData).toHaveBeenCalledExactlyOnceWith(f.proposal.sourceCommit);
	expect({ metadata: f.metadata, proposal: f.proposal }).toEqual(before);
});

test('featurePlanImpact rejects malformed input before reading committed metadata', async () => {
	const f = fixture();
	for (const input of [
		null,
		{},
		{ ...f.proposal, sourceCommit: 'main' },
		{ ...f.proposal, changes: null }
	]) {
		await expect(featurePlanImpact(input, { readData: f.readData })).rejects.toThrow();
	}
	expect(f.readData).not.toHaveBeenCalled();
});

test('featurePlanImpact reports stale metadata and every incomplete graph blocker', async () => {
	const f = fixture();
	f.metadata.commit = 'f'.repeat(40);
	delete f.metadata.relationships['component.shared'];
	const result = await featurePlanImpact(f.proposal, { readData: f.readData });
	expect(result.valid).toBe(false);
	expect(result.errors.join(' ')).toMatch(/commit|revision/i);
	expect(result.errors.join(' ')).toMatch(/relationship/i);
});

test('registerFeaturePlanImpact prints blockers and fails the CLI without a provider', async () => {
	const f = fixture();
	delete f.metadata.relationships['component.shared'];
	const program = new Command().exitOverride();
	const output = vi.fn();
	const readInput = vi.fn(async () => f.proposal);
	const previous = process.exitCode;
	process.exitCode = 0;
	try {
		registerFeaturePlanImpact(
			program,
			(input) => featurePlanImpact(input, { readData: f.readData }),
			readInput,
			output
		);
		await program.parseAsync(['impact', '--input', 'proposal.json', '--json'], { from: 'user' });
		const result = JSON.parse(output.mock.calls[0][0]);
		expect(readInput).toHaveBeenCalledExactlyOnceWith('proposal.json');
		expect(result.valid).toBe(false);
		expect(result.errors.join(' ')).toMatch(/relationship/i);
		expect(process.exitCode).toBe(1);
	} finally {
		process.exitCode = previous;
	}
});
