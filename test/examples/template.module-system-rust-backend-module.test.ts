import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { rustBackendModule } from '../../src/templates/module-system/rustBackendModule';

const state = 'declares-a-bounded-rust-backend-resource';

test('Declares a bounded Rust backend resource', () => {
	const definition = rustBackendModule;
	const files = definition.resources[0].files.map(({ path, contents }) => ({
		path: path.replaceAll('{{kebabName}}', 'billing-api').replaceAll('{{snakeName}}', 'billing_api'),
		lines: contents.split('\n').filter((line) =>
			/\[workspace\]|127\.0\.0\.1|DefaultBodyLimit|1_000_000|BAD_REQUEST|bounded_calculation/.test(line)
		)
	}));
	const output = {
		resource: definition.resources[0].id,
		files,
		commands: definition.packageScripts
	};

	expect(files.map(({ path }) => path)).toContain('src/services/rust-backend/billing-api/src/lib.rs');
	expect(files.find(({ path }) => path.endsWith('src/lib.rs'))?.lines).toContain('        .route("/run", post(run)).layer(DefaultBodyLimit::max(16 * 1024))');
	recordExampleCases(
		{
			unitId: 'template.module-system-rust-backend-module',
			symbol: 'rustBackendModule',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'billing API resource includes isolated Cargo package and bounded HTTP service',
				input: { resourceName: 'billing-api' },
				output
			}
		]
	);
});
