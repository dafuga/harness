import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	mailerFiles,
	helperFiles,
	concernFiles,
	channelFiles,
	formFiles,
	initializerFiles,
	configFiles,
	middlewareFiles,
	resourceFiles
} from '../../src/templates/development-tooling/railsPieces';

test('Generates named Rails scaffold files', () => {
	const cases = [
		{ name: 'mailer', input: 'invoice', output: mailerFiles('invoice') },
		{ name: 'helper', input: 'invoice', output: helperFiles('invoice') },
		{ name: 'concern', input: 'invoice', output: concernFiles('invoice') },
		{ name: 'channel', input: 'invoice', output: channelFiles('invoice') },
		{ name: 'form', input: 'invoice', output: formFiles('invoice') },
		{ name: 'initializer', input: 'invoice', output: initializerFiles('invoice') },
		{ name: 'config', input: 'invoice', output: configFiles('invoice') },
		{ name: 'middleware', input: 'invoice', output: middlewareFiles('invoice') }
	];

	expect(cases.map((item) => item.output[0]?.path)).toEqual([
		'src/mailers/InvoiceMailer.ts',
		'src/helpers/invoice.ts',
		'src/concerns/withInvoice.ts',
		'src/channels/InvoiceChannel.ts',
		'src/forms/InvoiceForm.ts',
		'src/initializers/initializeInvoice.ts',
		'src/configs/invoiceConfig.ts',
		'src/middleware/InvoiceMiddleware.ts'
	]);
	recordExampleCases(
		{
			unitId: 'template.rails-pieces',
			symbol: 'railsPieces',
			state: 'generates-named-rails-scaffold-files',
			evidence: 'examples-cases',
			file: 'generates-named-rails-scaffold-files.json'
		},
		cases.map(({ name, input, output }) => ({
			name,
			input: { name: input },
			output: output.map(({ path, contents }) => ({ path, contents }))
		}))
	);
});

test('Combines resource scaffold files with the fixed title field', () => {
	const files = resourceFiles('invoice');
	const model = files.find((file) => file.contents.includes('title: string;'));
	expect(model).toBeDefined();
	expect(model?.contents).toContain('title: string;');
	recordExampleCases(
		{
			unitId: 'template.rails-pieces',
			symbol: 'resourceFiles',
			state: 'combines-resource-scaffold-files-with-the-fixed-title-field',
			evidence: 'examples-cases',
			file: 'combines-resource-scaffold-files-with-the-fixed-title-field.json'
		},
		[
			{
				name: 'invoice resource model declares the fixed title field',
				input: { name: 'invoice' },
				output: model
					? { path: model.path, contents: model.contents }
					: null
			}
		]
	);
});
