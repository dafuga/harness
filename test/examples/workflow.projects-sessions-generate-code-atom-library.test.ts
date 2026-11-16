import { test } from 'vitest';
import { atomLibrary, useAtomLibrary } from '../../src/workflows/projects-sessions/generate-code/atomLibrary';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Defaults to the standard atom library when src is absent', async () => {
	await withTempDir('atom-library-default-', (directory) => {
		const output = atomLibrary(directory);
		expect(output).toBe('src/components/atoms');
		recordExampleCases(
			{
				unitId: 'workflow.projects-sessions-generate-code-atom-library',
				symbol: 'atomLibrary',
				state: 'defaults-to-the-standard-atom-library-when-src-is-absent',
				evidence: 'examples-cases',
				file: 'defaults-to-the-standard-atom-library-when-src-is-absent.json'
			},
			[{ name: 'missing source folder uses the standard library', input: { root: directory }, output }]
		);
	});
});

test('Keeps the planned files when using the standard atom library', () => {
	const files = [
		{
			path: 'src/components/forms/SubmitForm.svelte',
			contents: "<script>import HtmlButton from '../atoms/HtmlButton.svelte';</script>\n<HtmlButton type=\"submit\">Submit</HtmlButton>"
		}
	];
	const output = useAtomLibrary(files, 'src/components/atoms');
	expect(output).toBe(files);
	recordExampleCases(
		{
			unitId: 'workflow.projects-sessions-generate-code-atom-library',
			symbol: 'useAtomLibrary',
			state: 'keeps-the-planned-files-when-using-the-standard-atom-library',
			evidence: 'examples-cases',
			file: 'keeps-the-planned-files-when-using-the-standard-atom-library.json'
		},
		[
			{
				name: 'standard library leaves the planned file unchanged',
				input: { files, directory: 'src/components/atoms' },
				output
			}
		]
	);
});
