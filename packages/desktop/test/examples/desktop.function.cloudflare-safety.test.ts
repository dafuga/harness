import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { cloudflareSafety } from '../../src/utils/networking-security/cloudflareSafety';
import { CloudflareSafetyError } from '../../src/utils/networking-security/cloudflareSafety.types';

type Config = Record<string, unknown>;
type Targets = Parameters<typeof cloudflareSafety>[1];

const ACCOUNT = '3f9c2a7e1b8d4c60a5e9f1d2c3b4a596';
const OVERLAP =
	'A lower Worker environment inherits or overlaps a production route. Configure distinct hosts.';
const AMBIGUOUS = 'Cloudflare route mapping is ambiguous.';
const PROD_ROUTE = [{ pattern: 'reports.example.com/*' }];
const STAGE_ROUTE = [{ pattern: 'staging.reports.example.com/*' }];

const prodTarget = {
	environment: 'prod',
	kind: 'workers',
	config: 'wrangler.jsonc',
	name: 'reports-worker',
	accountId: ACCOUNT,
	tokenEnv: 'EXAMPLE_PROD_TOKEN_ENV',
	wranglerEnvironment: 'production',
	branch: '',
	output: '',
	healthUrl: 'https://reports.example.com/health'
};
const stageTarget = {
	...prodTarget,
	environment: 'stage',
	name: 'reports-worker-staging',
	tokenEnv: 'EXAMPLE_STAGE_TOKEN_ENV',
	wranglerEnvironment: 'staging',
	healthUrl: 'https://staging.reports.example.com/health'
};
const targets = { prod: prodTarget, stage: stageTarget } as Targets;

/** Top-level production route, with the staging environment's routes supplied by the caller. */
function reportsConfig(staging: unknown): Config {
	return {
		name: 'reports-worker',
		account_id: ACCOUNT,
		routes: PROD_ROUTE,
		env: {
			production: { name: 'reports-worker', routes: PROD_ROUTE },
			staging: { name: 'reports-worker-staging', routes: staging }
		}
	};
}

const staged = reportsConfig(STAGE_ROUTE);
const apiConfig: Config = {
	name: 'api-worker',
	account_id: '5b0f7c2e9a1d4e3b8c6f0a2d9e7b1c45',
	env: {
		production: { name: 'api-worker', route: 'api.example.com/*' },
		staging: { name: 'api-worker-staging', route: 'api-staging.example.com/*' }
	}
};
const inheritedConfig: Config = {
	name: 'reports-worker',
	account_id: ACCOUNT,
	routes: PROD_ROUTE,
	env: {
		production: { name: 'reports-worker' },
		staging: { name: 'reports-worker-staging' }
	}
};

function meta(state: string) {
	return {
		unitId: 'desktop.function.cloudflare-safety',
		symbol: 'cloudflareSafety',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function capture(config: Config): unknown {
	try {
		cloudflareSafety(config, targets);
	} catch (error) {
		return error;
	}
	return undefined;
}

function summary(error: unknown): { name: string; message: string } {
	if (!(error instanceof Error)) throw new Error('Expected an Error.');
	return { name: error.name, message: error.message };
}

test('Accepts lower environments on distinct hosts', () => {
	const reports = cloudflareSafety(staged, targets);
	const api = cloudflareSafety(apiConfig, targets);

	expect(reports).toBeUndefined();
	expect(api).toBeUndefined();

	recordExampleCases(meta('accepts-lower-environments-on-distinct-hosts'), [
		{
			name: 'reports-worker with a distinct staging host',
			input: staged,
			output: { returned: String(reports) }
		},
		{
			name: 'api-worker with singular route mappings',
			input: apiConfig,
			output: { returned: String(api) }
		}
	]);
});

test('Rejects a lower route that overlaps production', () => {
	const config = reportsConfig([{ pattern: 'reports.example.com/preview/*' }]);
	const thrown = capture(config);

	expect(thrown).toBeInstanceOf(CloudflareSafetyError);
	const error = summary(thrown);
	expect(error.message).toBe(OVERLAP);

	recordExampleCases(meta('rejects-a-lower-route-that-overlaps-production'), [
		{ name: 'staging route on the production hostname', input: config, error }
	]);
});

test('Rejects an inherited production route', () => {
	const thrown = capture(inheritedConfig);

	expect(thrown).toBeInstanceOf(CloudflareSafetyError);
	const error = summary(thrown);
	expect(error.message).toBe(OVERLAP);

	recordExampleCases(meta('rejects-an-inherited-production-route'), [
		{
			name: 'staging inherits the top-level production route',
			input: inheritedConfig,
			error
		}
	]);
});

test('Rejects a wildcard route in a lower environment', () => {
	const config = reportsConfig(['*.example.com/*']);
	const thrown = capture(config);

	expect(thrown).toBeInstanceOf(CloudflareSafetyError);
	const error = summary(thrown);
	expect(error.message).toBe(OVERLAP);

	recordExampleCases(meta('rejects-a-wildcard-route-in-a-lower-environment'), [
		{ name: 'wildcard host in the staging route', input: config, error }
	]);
});

test('Rejects an ambiguous route mapping', () => {
	const config = reportsConfig([{ pattern: 42 }]);
	const thrown = capture(config);

	expect(thrown).toBeInstanceOf(CloudflareSafetyError);
	const error = summary(thrown);
	expect(error.message).toBe(AMBIGUOUS);

	recordExampleCases(meta('rejects-an-ambiguous-route-mapping'), [
		{ name: 'staging route pattern that is not a string', input: config, error }
	]);
});

test('Rejects a route pattern that is not a URL', () => {
	const config = reportsConfig([{ pattern: 'http://[bad/*' }]);
	const thrown = capture(config);

	expect(thrown).toBeInstanceOf(TypeError);
	const error = summary(thrown);

	recordExampleCases(meta('rejects-a-route-pattern-that-is-not-a-url'), [
		{ name: 'staging pattern that new URL cannot parse', input: config, error }
	]);
});
