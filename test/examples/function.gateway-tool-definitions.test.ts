import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gatewayToolDefinitions } from '../../src/utils/development-tooling/gatewayToolDefinitions';

function captureError(input: Record<string, unknown>[]) {
	try {
		gatewayToolDefinitions(input);
		return '';
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

test('Flattens namespaces and rejects unsupported tools', () => {
	const direct = [{ type: 'function', name: 'lookup_weather' }];
	const nested = [
		{
			type: 'namespace',
			name: 'outer',
			tools: [
				{
					type: 'namespace',
					name: 'inner',
					tools: [{ type: 'custom', name: 'get_forecast' }]
				}
			]
		}
	];
	const invalidNamespace = [{ type: 'namespace', name: 'broken', tools: null }];
	const unsupported = [{ type: 'hosted_search', name: 'search_docs' }];
	const directOutput = gatewayToolDefinitions(direct);
	const nestedOutput = gatewayToolDefinitions(nested);
	const invalidError = captureError(invalidNamespace);
	const unsupportedError = captureError(unsupported);

	expect(directOutput).toEqual(direct);
	expect(nestedOutput).toEqual([
		{ type: 'custom', name: 'get_forecast', namespace: 'outer' }
	]);
	expect(invalidError).toBe('Invalid namespace tools');
	expect(unsupportedError).toBe(
		'Unsupported hosted tool; disable it explicitly for this provider'
	);
	recordExampleCases(
		{
			unitId: 'function.gateway-tool-definitions',
			symbol: 'gatewayToolDefinitions',
			state: 'flattens-namespaces-and-rejects-unsupported-tools',
			evidence: 'examples-cases',
			file: 'flattens-namespaces-and-rejects-unsupported-tools.json'
		},
		[
			{ name: 'direct supported function', input: direct, output: directOutput },
			{ name: 'outer namespace overrides nested namespace', input: nested, output: nestedOutput },
			{ name: 'namespace tools must be an array', input: invalidNamespace, error: invalidError },
			{ name: 'unsupported hosted tool is rejected', input: unsupported, error: unsupportedError }
		]
	);
});
