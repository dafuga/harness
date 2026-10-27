import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { agentLiveness } from '../../src/services/agent-activity-service/agentLiveness';
import { type AgentFacts, type ProcessFacts } from '../../src/utils/agentLiveness';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import { usageExamples } from '../../packages/reports/src/components/shared-primitives/usage-examples/usageExamples';
import unit from '../../specification/units/function.agent-liveness.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

const ago = (now: number, seconds: number) => new Date(now - seconds * 1000).toISOString();

function checkDisplay(
	agent: AgentFacts,
	now: number,
	process: ProcessFacts | { $fixture: 'throwing-process'; message: string }
) {
	const example = unit.testing.examples.find(
		(item) => JSON.stringify(item.input) === JSON.stringify([agent, now, process])
	);
	if (!example) throw new Error('Missing authored liveness example');
	const callback =
		'$fixture' in process
			? `() => { throw new Error(${JSON.stringify(process.message)}); }`
			: `() => (${JSON.stringify(process)})`;
	const call = `agentLiveness(${JSON.stringify(agent)}, ${now}, ${callback})`;
	expect(example.call, 'the displayed call uses the tested input').toBe(call);
	const failed = example.expected.kind === 'error';
	const expected = example.expected.value;
	const base = { name: example.name, call, input: example.input };
	const shown = failed ? { ...base, error: expected } : { ...base, output: expected };
	const comment = failed
		? `// throws { "name": ${JSON.stringify(expected.name)}, "message": ${JSON.stringify(expected.message)} }`
		: `// => { "state": ${JSON.stringify(expected.state)}, "detail": ${JSON.stringify(expected.detail)} }`;
	expect(usageExamples([shown])).toEqual([`${call}\n${comment}`]);
	return example.call;
}

function checkWorking(agent: AgentFacts, now: number, running: ProcessFacts) {
	const state = (facts: AgentFacts, found: ProcessFacts = running) =>
		agentLiveness(facts, now, () => found).state;
	expect(state({ ...agent, heartbeatAt: ago(now, 900) })).toBe('working');
	const owned = { ...agent, pid: 4242, processStartedAt: running.startedAt };
	expect(state(owned)).toBe('working');
	expect(state({ ...owned, processStartedAt: null }, { exists: true, startedAt: null })).toBe(
		'working'
	);
	expect(state(owned, { exists: undefined, startedAt: null })).toBe('working');
	let asked = 0;
	agentLiveness(agent, now, () => {
		asked += 1;
		return running;
	});
	expect(asked).toBe(0);
	expect(agentLiveness(agent, now, undefined as unknown as () => ProcessFacts).state).toBe(
		'working'
	);
}

function checkBoundaries(agent: AgentFacts, now: number, process: ProcessFacts, state: string) {
	if (state === 'working' && agent.pid === null && !agent.finished)
		checkWorking(agent, now, process);
	if (state === 'stale') {
		const idle = {
			...agent,
			heartbeatAt: ago(now, 7200),
			pid: 4242,
			processStartedAt: process.startedAt
		};
		expect(agentLiveness(idle, now, () => process).state).toBe('stale');
	}
	if (state === 'completed') {
		expect(agentLiveness({ ...agent, heartbeatAt: ago(now, 1) }, now, () => process).state).toBe(
			'completed'
		);
		expect(
			agentLiveness({ ...agent, pid: 4242 }, now, () => {
				throw new Error('Finished agents must not inspect processes');
			}).state
		).toBe('completed');
	}
}

async function checked(
	agent: AgentFacts,
	now: number,
	process: ProcessFacts | { $fixture: 'throwing-process'; message: string }
) {
	const call = checkDisplay(agent, now, process);
	const invoke = () =>
		new Function('agentLiveness', `return (${call});`)(agentLiveness) as ReturnType<
			typeof agentLiveness
		>;
	if ('$fixture' in process) {
		for (const invalid of [null, undefined])
			expect(() =>
				agentLiveness(invalid as unknown as AgentFacts, now, () => ({
					exists: true,
					startedAt: null
				}))
			).toThrow(TypeError);
		expect(() => agentLiveness(agent, now, undefined as unknown as () => ProcessFacts)).toThrow(
			TypeError
		);
		return invoke();
	}
	const result = await measureWorkload(
		'function.agent-liveness',
		'authored-liveness-example',
		invoke
	);
	let asked: number | null = null;
	const observed = agentLiveness(agent, now, (pid) => {
		asked = pid;
		return process;
	});
	expect(asked).toBe(agent.pid !== null && !agent.finished ? agent.pid : null);
	expect(observed).toEqual(result);
	checkBoundaries(agent, now, process, result.state);
	return result;
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	agentLiveness: checked
});
