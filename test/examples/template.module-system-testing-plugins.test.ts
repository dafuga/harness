import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { testingPlugins } from '../../src/templates/module-system/testingPlugins';

test('Generates the default headless browser smoke test', () => {
	const plugin = testingPlugins.find((entry) => entry.id === 'playwright');
	expect(plugin).toBeDefined();
	if (!plugin) throw new Error('Playwright plugin is missing');
	const resource = plugin.resources.find((entry) => entry.id === 'test');
	expect(resource).toBeDefined();
	if (!resource) throw new Error('Playwright test resource is missing');
	const file = resource.files[0];
	expect(file.contents).toContain("page.setContent('<button>Ready</button>')");
	recordExampleCases(
		{
			unitId: 'template.module-system-testing-plugins',
			symbol: 'testingPlugins',
			state: 'generates-the-default-headless-browser-smoke-test',
			evidence: 'examples-cases',
			file: 'generates-the-default-headless-browser-smoke-test.json'
		},
		[
			{
				name: 'Playwright installs a runnable browser smoke test by default',
				input: { id: 'playwright', includedByDefault: true },
				output: {
					path: file.path,
					lines: [
						"test('{{PascalName}}', async ({ page }) => {",
						" await page.setContent('<button>Ready</button>');",
						" await expect(page.getByRole('button', { name: 'Ready' })).toBeVisible();"
					]
				}
			}
		]
	);
});

test('Generates deterministic headless audio assertions', () => {
	const plugin = testingPlugins.find((entry) => entry.id === 'headless-audio');
	expect(plugin).toBeDefined();
	if (!plugin) throw new Error('Headless audio plugin is missing');
	const resource = plugin.resources.find((entry) => entry.id === 'test');
	expect(resource).toBeDefined();
	if (!resource) throw new Error('Headless audio test resource is missing');
	const file = resource.files[0];
	expect(file.contents).toContain('OfflineAudioContext');
	recordExampleCases(
		{
			unitId: 'template.module-system-testing-plugins',
			symbol: 'testingPlugins',
			state: 'generates-deterministic-headless-audio-assertions',
			evidence: 'examples-cases',
			file: 'generates-deterministic-headless-audio-assertions.json'
		},
		[
			{
				name: 'Audio resource renders PCM and checks its WAV playback',
				input: { id: 'headless-audio', headless: true },
				output: {
					path: file.path,
					lines: [
						"test('{{PascalName}} renders real PCM without a microphone or speakers'",
						'  const context = new OfflineAudioContext(1, 4800, 48000);',
						" expect(wav.toString('ascii', 0, 4)).toBe('RIFF');",
						' audio.clear();'
					]
				}
			}
		]
	);
});
