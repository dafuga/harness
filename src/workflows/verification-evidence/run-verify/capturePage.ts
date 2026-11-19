// @harness-uid u_srtmrphmgz
import { constants } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';
import { resourceWork } from '../../../utils/execution-runtimes/resourceWork';
import { runIsolated } from '../../../utils/reports-media/run-isolated/runIsolated';
import { mediaFacts } from '../../../utils/verification-evidence/mediaFacts';
import type { PageCaptureOptions } from './capturePage.types';

/** A one-page PNG from a temporary browser profile, independent of revision verification. */
export async function capturePage(address: string, options: PageCaptureOptions): Promise<string> {
	const url = pageUrl(address);
	const size = viewport(options.viewport);
	const browser = Bun.which(options.browser);
	if (!browser)
		return fail('Install Chrome Headless Shell or provide its executable with --browser.');
	const output = resolve(options.output);
	const directory = await mkdtemp(join(tmpdir(), 'harness-page-'));
	try {
		const screenshot = join(directory, 'page.png');
		const args = [
			'--headless',
			'--no-first-run',
			`--user-data-dir=${join(directory, 'profile')}`,
			`--window-size=${size}`,
			'--timeout=15000',
			`--screenshot=${screenshot}`,
			url.href
		];
		const result = await resourceWork({ label: 'Page screenshot' }, (worker) =>
			runIsolated({
				command: browser,
				args,
				cwd: directory,
				env: process.env,
				timeoutMs: 30_000,
				log: join(directory, 'browser.log'),
				maxLogBytes: 32_000,
				onSpawn: worker.track
			})
		);
		if (result.status !== 'passed') return fail(`Page capture ${result.status}.`);
		const image = await readFile(screenshot).catch(() => fail('Browser did not produce a PNG.'));
		const facts = mediaFacts(image, 'image/png');
		if (!('kind' in facts) || facts.kind !== 'image')
			return fail('Browser produced an invalid PNG.');
		await copyFile(screenshot, output, constants.COPYFILE_EXCL);
		return output;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function pageUrl(address: string): URL {
	const url = URL.canParse(address) ? new URL(address) : undefined;
	if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		return fail('Use an HTTP or HTTPS page URL without embedded credentials.');
	}
	return url;
}

function viewport(size: string): string {
	const match = /^(\d{2,4})x(\d{2,4})$/.exec(size);
	const width = Number(match?.[1]);
	const height = Number(match?.[2]);
	if (!width || !height || width > 3840 || height > 2160)
		return fail('Use a viewport up to 3840x2160.');
	return `${width},${height}`;
}
