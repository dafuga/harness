import { test } from 'vitest';
import { emailModule } from '../../src/templates/module-system/emailModule';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Defines server email delivery and reusable mailer scaffolds', () => {
	const resource = emailModule.resources[0];
	const output = {
		version: emailModule.version,
		setupFiles: emailModule.setup.map((file) => file.path),
		resource: {
			id: resource.id,
			kind: resource.kind,
			files: resource.files.map((file) => ({
				path: file.path,
				firstLine: file.contents.split('\n')[0]
			}))
		}
	};

	expect(output.version).toBe('1.0.0');
	expect(output.setupFiles).toContain('src/services/email/email.server.ts');
	expect(output.resource.files[1]?.firstLine).toContain('import type');
	recordExampleCases(
		{
			unitId: 'template.module-system-email-module',
			symbol: 'emailModule',
			state: 'defines-server-email-delivery-and-reusable-mailer-scaffolds',
			evidence: 'examples-cases',
			file: 'defines-server-email-delivery-and-reusable-mailer-scaffolds.json'
		},
		[
			{
				name: 'email module declares server delivery and templated mailer files',
				input: { id: emailModule.id },
				output
			}
		]
	);
});
