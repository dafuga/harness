import { test } from 'vitest';
import { audioTestingFiles } from '../../src/templates/module-system/audioTestingFiles';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Emits headless audio service and runner files', () => {
	const typeFile = audioTestingFiles.find((file) => file.path.endsWith('HeadlessAudioService.types.ts'));
	const configFile = audioTestingFiles.find((file) => file.path.endsWith('audioPlaywrightConfig.ts'));
	expect(typeFile?.contents).toContain('export interface AudioChunk');
	expect(configFile?.contents).toContain("browserName: 'chromium'");
	recordExampleCases(
		{
			unitId: 'template.module-system-audio-testing-files',
			symbol: 'audioTestingFiles',
			state: 'emits-headless-audio-service-and-runner-files',
			evidence: 'examples-cases',
			file: 'emits-headless-audio-service-and-runner-files.json'
		},
		[
			{
				name: 'service type declaration',
				input: { file: 'HeadlessAudioService.types.ts' },
				output: {
					path: typeFile?.path,
					lines: typeFile?.contents.trim().split('\n')
				}
			},
			{
				name: 'Playwright runner configuration',
				input: { file: 'audioPlaywrightConfig.ts' },
				output: {
					path: configFile?.path,
					lines: configFile?.contents.trim().split('\n').filter((line) =>
						/testDir|outputDir|headless|browserName|workers|reporter/.test(line)
					)
				}
			}
		]
	);
});
