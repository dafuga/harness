import { expect } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { runCommand, runHarness } from './cli';
import { browserErrorCollector } from './browserTest';

/** Compile both declared Rust targets and exercise their actual browser and HTTP boundaries. */
export async function assertRustModuleProject(project: string): Promise<void> {
	for (const id of ['rust-wasm', 'rust-backend']) {
		await runHarness(['module', 'add', id], project);
		await runHarness(['module', 'generate', id, 'kernel', 'Metrics'], project);
	}
	await runCommand(['bun', 'run', 'build:wasm', 'metrics'], project);
	const manifest = 'src/services/rust-backend/metrics/Cargo.toml';
	const target = join(project, '.cache/rust-backend/metrics');
	await runCommand(['cargo', 'test', '--manifest-path', manifest, '--target-dir', target], project);
	await runCommand(
		['cargo', 'build', '--manifest-path', manifest, '--target-dir', target],
		project
	);
	await assertRustHttp(join(target, 'debug/metrics'), project);
	await assertRustBrowser(project);
}

async function assertRustHttp(binary: string, project: string): Promise<void> {
	const child = spawn(binary, [], {
		cwd: project,
		env: { ...process.env, PORT: '0' },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	let output = '';
	child.stdout.on('data', (bytes) => {
		output += String(bytes);
	});
	child.stderr.resume();
	try {
		const deadline = Date.now() + 15000;
		while (!output.includes('LISTENING ') && child.exitCode === null && Date.now() < deadline)
			await new Promise((resolve) => setTimeout(resolve, 50));
		const url = /LISTENING (http:\/\/127\.0\.0\.1:\d+)/.exec(output)?.[1];
		expect(url, 'Rust backend announces its loopback listener').toBeTruthy();
		expect((await fetch(url + '/health')).status).toBe(200);
		const response = await fetch(url + '/run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ limit: 4 })
		});
		expect(await response.json()).toEqual({ total: 14 });
		expect(
			(
				await fetch(url + '/run', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ limit: 1000001 })
				})
			).status
		).toBe(400);
	} finally {
		child.kill('SIGTERM');
		await new Promise<void>((resolve) => {
			if (child.exitCode !== null || child.signalCode) resolve();
			else child.once('exit', () => resolve());
		});
	}
}
async function assertRustBrowser(project: string): Promise<void> {
	await runCommand(
		[
			'bun',
			'build',
			'src/services/rust-wasm/MetricsWasmService.ts',
			'--target',
			'browser',
			'--outfile',
			'.cache/wasm-service.js'
		],
		project
	);
	const { chromium } = await import('@playwright/test');
	const browser = await chromium.launch();
	const context = await browser.newContext();
	const errors = browserErrorCollector('chromium');
	errors.watch(context);
	try {
		const page = await context.newPage();
		const wasm = await readFile(join(project, 'static/wasm/metrics.wasm'));
		const script = await readFile(join(project, '.cache/wasm-service.js'));
		await page.route('http://rust-module.fixture/**', (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path === '/metrics.wasm')
				return route.fulfill({ contentType: 'application/wasm', body: wasm });
			if (path === '/service.js')
				return route.fulfill({ contentType: 'text/javascript', body: script });
			return route.fulfill({
				contentType: 'text/html',
				body: '<!doctype html><html><head><title>Rust module</title></head><body>Rust module execution fixture</body></html>'
			});
		});
		await page.goto('http://rust-module.fixture/');
		const total = await page.evaluate(async (moduleUrl) => {
			const { MetricsWasmService } = await import(moduleUrl);
			return new MetricsWasmService('/metrics.wasm').sumSquares(4);
		}, '/service.js');
		expect(total).toBe(14);
		await errors.finish();
	} finally {
		await context.close();
		await browser.close();
	}
}
