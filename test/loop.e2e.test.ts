import { test, vi } from 'vitest';
import { Command } from 'commander';
import { registerLoopCommand } from '../src/cli/program/loop';
import { TestExpectationService } from '../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../src/core/unitTypes';
import type { LoopExampleInput } from './support/loop-repair/loopCommandExamples.types';
import {
	createTrace,
	generatedGuidance,
	templateEvaluation
} from './support/loop-repair/loopCommandExamples';
import { repairExample, captureExample } from './support/loop-repair/loopCommandProofExamples';
import manifest from '../specification/units/command.loop.json';

vi.setConfig({ testTimeout: 120_000 });
const examples = {
	create: createTrace,
	guidance: generatedGuidance,
	evaluate: templateEvaluation,
	capture: captureExample
};

async function invokeLoop(...input: never[]): Promise<void> {
	const [fixture] = input as unknown as [LoopExampleInput];
	let program: unknown = new Command();
	if (fixture.fixture === 'null') program = null;
	if (fixture.fixture === 'undefined') program = undefined;
	if (fixture.fixture === 'object') program = {};
	const actual = registerLoopCommand(program as Command);
	if (fixture.fixture === 'repair') await repairExample(fixture.template!);
	else if (Object.hasOwn(examples, fixture.fixture))
		await examples[fixture.fixture as keyof typeof examples]();
	return actual;
}
new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	registerLoopCommand: invokeLoop
});
