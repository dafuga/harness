import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { gatewayPrompt } from '../../src/services/claude-query-service/gatewayPrompt';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import type { GatewayRequest } from '../../src/utils/gatewayTypes';
import unit from '../../specification/units/function.gateway-prompt.json' with { type: 'json' };
import { measureWorkload } from '../support/measureWorkload';

async function checked(
	request: GatewayRequest | { $fixture: 'throwing-history'; message: string }
): Promise<string> {
	const example = unit.testing.examples.find(
		(item) => JSON.stringify(item.input) === JSON.stringify([request])
	);
	const call =
		'$fixture' in request
			? `gatewayPrompt({ get input() { throw new Error(${JSON.stringify(request.message)}); } })`
			: `gatewayPrompt(${JSON.stringify(request)})`;
	expect(example?.call, 'the displayed call uses the tested input').toBe(call);
	if ('$fixture' in request) return throwingHistory(request.message);
	const result = await measureWorkload(
		'function.gateway-prompt',
		'authored-conversation-example',
		() => gatewayPrompt(request)
	);
	expect(result).toContain(JSON.stringify(request.input));
	expect(
		gatewayPrompt({
			...request,
			model: 'other-model',
			stream: false as unknown as true,
			tools: [{ name: 'other' }],
			instructions: 'ignored'
		})
	).toBe(result);
	return result;
}

function throwingHistory(message: string): string {
	const base = { model: 'fixture', stream: true as const, tools: [] };
	const cycle: Record<string, unknown> = {};
	cycle.self = cycle;
	for (const invalid of [
		null,
		undefined,
		{ ...base, input: [cycle] },
		{ ...base, input: [{ value: 1n }] }
	]) {
		expect(() => gatewayPrompt(invalid as GatewayRequest)).toThrow(TypeError);
	}
	return gatewayPrompt({
		...base,
		get input(): never {
			throw new Error(message);
		}
	});
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	gatewayPrompt: checked
});
