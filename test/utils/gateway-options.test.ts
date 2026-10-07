import { expect, test, vi } from 'vitest';
import { gatewayOptions } from '../../src/utils/gatewayOptions';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
test('subscription bridge excludes API billing overrides and builtin execution tools', () => {
	vi.stubEnv('ANTHROPIC_API_KEY', 'synthetic');
	vi.stubEnv('ANTHROPIC_BASE_URL', 'https://wrong.example');
	try {
		const options = gatewayOptions(new CodexSessionRepository().create('thread'));
		expect(options.env?.ANTHROPIC_API_KEY).toBeUndefined();
		expect(options.env?.ANTHROPIC_BASE_URL).toBeUndefined();
		expect(options.tools).toEqual([]);
		expect(options.settingSources).toEqual([]);
	} finally {
		vi.unstubAllEnvs();
	}
});
