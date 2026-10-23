import type { ShellPage } from './shellFixture.types';
import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BuildIdentityService } from '../../../../../src/services/BuildIdentityService';
import {
	evidenceRequested,
	recordCapture
} from '../../../../../src/utils/record-capture/recordCapture';

/** The address the fixture pages are opened at; nothing listens there. */
export const shellOrigin = 'http://shell.fixture';
const config = 'src/configs/shellViteConfig.ts';
/** Where the setup of a verification compiles the fixture: the build its captures are tied to. */
const compiled = 'output/shell-fixture';
const types: Record<string, string> = { js: 'text/javascript', css: 'text/css' };

/**
 * Builds the asked pages of the shell fixture into a directory of this run. A page that does
 * not build is left out, and opening it says so; another page is still there to be looked at.
 * A verification has compiled the fixture already, and building it again would change the
 * build it identified: its pages are served as they are.
 */
export function buildShellFixture(pages: ShellPage[]): string {
	if (process.env.HARNESS_VERIFY) return compiled;
	if (pages.includes('catalog')) prepareCatalog();
	mkdirSync('output', { recursive: true });
	const home = mkdtempSync(join('output', 'shell-fixture-'));
	for (const page of pages) {
		const env = { ...process.env, SHELL_FIXTURE_PAGE: page, SHELL_FIXTURE_OUT: join(home, page) };
		try {
			execFileSync('bun', ['x', 'vite', 'build', '--config', config], { env, stdio: 'pipe' });
		} catch (reason) {
			const said = String((reason as { stderr?: Buffer }).stderr ?? reason);
			console.warn(`the ${page} page of the shell fixture did not build:\n${said.slice(0, 600)}`);
			if (page === 'catalog') throw reason;
		}
	}
	return home;
}

/** Cross-workspace components need each application's generated SvelteKit type configuration. */
function prepareCatalog() {
	for (const directory of ['.', '../desktop', '../hub']) {
		execFileSync('bun', ['x', 'svelte-kit', 'sync'], { cwd: resolve(directory), stdio: 'pipe' });
	}
}

/** Removes what this run built; what a verification compiled is not this run's to remove. */
export function removeShellFixture(home: string): void {
	if (home !== compiled) rmSync(home, { recursive: true, force: true });
}

/**
 * Opens a page of the fixture. Its script and stylesheet are answered from the files of this
 * run, and every other path is the page itself, as a host serves the console at any address.
 */
export async function openShellPage(
	page: Page,
	home: string,
	name: ShellPage,
	search = ''
): Promise<void> {
	const built = join(home, name);
	if (!existsSync(join(built, 'page.iife.js')))
		throw new Error(`the ${name} page of the shell fixture was not built`);
	const html =
		'<!doctype html><html lang="en"><head><meta charset="utf-8">' +
		'<meta name="viewport" content="width=device-width, initial-scale=1"><title>Shell</title>' +
		'<link rel="stylesheet" href="/page.css"></head><body><div id="app"></div>' +
		'<script src="/page.iife.js"></script></body></html>';
	await page.route(`${shellOrigin}/**`, (route) => {
		const file = /\/(page\.(?:iife\.js|css))$/.exec(new URL(route.request().url()).pathname)?.[1];
		if (!file) return route.fulfill({ contentType: 'text/html', body: html });
		const contentType = types[file.split('.').pop() ?? ''];
		return route.fulfill({ contentType, body: readFileSync(join(built, file)) });
	});
	await page.goto(`${shellOrigin}/${search}`);
}

/**
 * Keeps what the screen shows as evidence of a state, for a run that asked for evidence. The
 * capture names the files the page was answered from, by their identity, and the revision a
 * verification is of; outside one it names a placeholder that claims no commit.
 */
export async function captureShell(
	page: Page,
	home: string,
	shown: { state: string; viewport: string; slot?: string }
): Promise<void> {
	if (!evidenceRequested()) return;
	const served = await new BuildIdentityService().identify(home);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40);
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	const bytes = await page.screenshot({ animations: 'disabled', caret: 'hide' });
	const { state, viewport, slot = 'screens' } = shown;
	recordCapture(
		{
			evidence: slot,
			kind: 'screenshot',
			state,
			viewport,
			file: `${shown.state}-${shown.viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: served?.buildId ?? 'not-built', revision }
		},
		bytes
	);
}

export type { ShellPage } from './shellFixture.types';
