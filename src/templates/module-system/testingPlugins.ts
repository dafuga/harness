import { audioTestingFiles } from './audioTestingFiles';
import { browserTestingFiles } from './browserTestingFiles';

const audioTest = `import { test, expect } from '../plugin-support/browserTest';
import { HeadlessAudioService } from '../../src/services/headless-audio/HeadlessAudioService';
test('{{PascalName}} renders real PCM without a microphone or speakers', async ({ page }) => {
 const samples = await page.evaluate(async () => {
  const context = new OfflineAudioContext(1, 4800, 48000);
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 440;
  oscillator.connect(context.destination); oscillator.start();
  const rendered = await context.startRendering();
  return Array.from(rendered.getChannelData(0));
 });
 expect(samples).toHaveLength(4800);
 expect(samples.some(sample => Math.abs(sample) > 0.1)).toBe(true);
 const audio = new HeadlessAudioService(48000);
 audio.enqueue(Int16Array.from(samples, sample => Math.round(sample * 32767)));
 expect(audio.next(480).some(sample => sample !== 0)).toBe(true);
 expect(audio.playedMs).toBe(10);
 expect(audio.wav().toString('ascii', 0, 4)).toBe('RIFF');
 audio.clear();
 expect([...audio.next(480)].every(sample => sample === 0)).toBe(true);
});
`;

/** Testing plugins use the same installation, template and instruction contract as capabilities. */
export const testingPlugins = [
	{
		schemaVersion: 1,
		id: 'playwright',
		version: '1.0.0',
		title: 'Playwright',
		description: 'Headless Chromium browser tests, included by default.',
		includedByDefault: true,
		testing: { headless: true, script: 'test:browser' },
		instructions: [
			'Available from the start: harness plugin generate playwright test Smoke prepares the isolated headless config and a runnable browser test.',
			'Run bun install and bun x playwright install chromium once, then harness plugin test playwright. No browser is installed or launched by generation.',
			'The generated smoke test runs without an app server. For application flows, explicitly navigate to your test environment and manage its lifecycle in fixtures.',
			'Headless mode is required. Real application login, production providers and native devices require separate integration evidence.'
		],
		setup: browserTestingFiles,
		dependencies: {},
		devDependencies: { '@playwright/test': '^1.28.1' },
		packageScripts: {
			'test:browser': 'playwright test --config src/configs/testing/browserPlaywrightConfig.ts'
		},
		resources: [
			{
				id: 'test',
				title: 'Browser tests',
				singular: 'Browser test',
				kind: 'e2e',
				instructions: [
					'Generate, run bun install, then harness plugin test playwright. Replace the smoke page with your actual application flow and assertions.'
				],
				files: [
					{
						path: 'tests/browser/{{kebabName}}.spec.ts',
						contents:
							"import { test, expect } from '../plugin-support/browserTest';\ntest('{{PascalName}}', async ({ page }) => {\n await page.setContent('<button>Ready</button>');\n await expect(page.getByRole('button', { name: 'Ready' })).toBeVisible();\n});\n"
					}
				]
			}
		]
	},
	{
		schemaVersion: 1,
		id: 'headless-audio',
		version: '1.0.0',
		title: 'Headless audio',
		description:
			'Deterministic audio playback, interruption and PCM/WAV assertions without speakers or a microphone.',
		testing: { headless: true, script: 'test:audio' },
		instructions: [
			'Reference: Elan tests instrument browser playback without a microphone; Nudge simulates queued playout, interruption and recorded PCM frames. This plugin reuses those boundaries without their app or provider dependencies.',
			'Generate a test, run bun install and bun x playwright install chromium once, then harness plugin test headless-audio.',
			'Feed consented or synthetic PCM into HeadlessAudioService, step its deterministic clock, assert playout and clear behavior, and retain matched transcripts with speech recordings.',
			'Use OfflineAudioContext for real headless Web Audio rendering. No microphone access, physical speaker output, paid provider calls or human speech accuracy is established.',
			'Keep application/provider adapters separate. Do not commit private recordings or provider credentials.'
		],
		setup: audioTestingFiles,
		dependencies: {},
		devDependencies: { '@playwright/test': '^1.28.1' },
		packageScripts: {
			'test:audio': 'playwright test --config src/configs/testing/audioPlaywrightConfig.ts'
		},
		resources: [
			{
				id: 'test',
				title: 'Audio tests',
				singular: 'Audio test',
				kind: 'e2e',
				instructions: [
					'Assert rendered PCM, playout order, silence and interruption; test real application routing and provider behavior separately.'
				],
				files: [{ path: 'tests/audio/{{kebabName}}.spec.ts', contents: audioTest }]
			}
		]
	}
];
