import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { ReportRepository } from '../src/repositories/ReportRepository';
const root = resolve('/tmp/project-reports-e2e');
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const image = join(root, 'fixture.png');
const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 960, height: 600 },
		deviceScaleFactor: 1
	});
	await page.setContent(`
		<style>
			*{box-sizing:border-box}body{margin:0;background:#0a1220;color:#eaf0f1;font:16px Arial}
			.dialog{margin:22px;border:1px solid #526879;border-radius:14px;overflow:hidden;background:#10202c}
			header{display:flex;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #31465a;font-weight:700}
			.toolbar{padding:18px 22px}.pill{display:inline-block;border:1px solid #536975;border-radius:8px;padding:9px 14px;margin-right:8px}
			.stage{height:420px;margin:0 22px 22px;background:#070e12;display:grid;place-items:center}
			.phone{width:220px;height:400px;background:#f9fbff;color:#213043;padding:16px;text-align:center}
			.line{height:12px;margin:12px auto;background:#dce4f3;border-radius:3px}.line.short{width:55%}
			.action{margin-top:55px;padding:8px;background:#405a84;color:white;border-radius:4px}
		</style>
		<div class="dialog"><header>Captured dialog <span>×</span></header>
		<div class="toolbar"><span class="pill">←</span><span class="pill">→</span><span class="pill">Mobile screenshots</span></div>
		<div class="stage"><div class="phone"><strong>Project photos</strong><div class="line"></div>
		<div class="line short"></div><div class="action">Take a photo</div></div></div></div>
	`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: image });
	await page.setContent(`
		<style>
			body{margin:0;background:#fff;color:#172b37;font:20px Arial}
			header{padding:38px 48px;background:#0e2939;color:#fff;font-size:36px;font-weight:700}
			section{margin:28px 48px;padding:26px;border:2px solid #b7c8cf;border-radius:12px}
			h2{margin:0 0 18px;font-size:30px}p{line-height:1.5}
		</style>
		<header>Tall report page</header>
		${Array.from({ length: 10 }, (_, index) => `<section><h2>Detail ${index + 1}</h2><p>Readable screenshot content for zoom and pan verification.</p></section>`).join('')}
	`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: join(root, 'tall.png'), fullPage: true });
	const large = await page.evaluate(() => {
		const canvas = document.createElement('canvas');
		canvas.width = 1024;
		canvas.height = 1024;
		const context = canvas.getContext('2d')!;
		const pixels = context.createImageData(1024, 1024);
		let seed = 17;
		for (let index = 0; index < pixels.data.length; index += 4) {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			pixels.data[index] = seed & 255;
			pixels.data[index + 1] = (seed >>> 8) & 255;
			pixels.data[index + 2] = (seed >>> 16) & 255;
			pixels.data[index + 3] = 255;
		}
		context.putImageData(pixels, 0, 0);
		return canvas.toDataURL('image/png').split(',')[1];
	});
	await writeFile(join(root, 'large.png'), Buffer.from(large, 'base64'));
} finally {
	await browser.close();
}
const store = new ReportRepository(root);
const report = await store.begin({
	project: '/tmp/alpha-project',
	title: 'Account settings review',
	mode: 'feature',
	environment: 'local fixture',
	acceptance: ['Settings remain readable on mobile']
});
await store.record(report.id, {
	kind: 'check',
	data: {
		id: 'save',
		title: 'Save settings',
		status: 'passed',
		command: 'bun run check',
		output: 'passed: 1'
	}
});
await store.record(report.id, {
	kind: 'coverage',
	data: {
		id: 'mobile',
		title: 'Settings',
		viewport: 'mobile',
		status: 'blocked',
		detail: 'Device verification pending'
	}
});
await store.record(report.id, {
	kind: 'evidence',
	data: {
		id: 'tall-desktop',
		title: 'Tall report page',
		category: 'Details',
		phase: 'current',
		viewport: '1440px desktop',
		path: join(root, 'tall.png'),
		status: 'passed'
	}
});
for (const [size, viewport] of [
	['mobile', '390px mobile'],
	['tablet', '920px tablet'],
	['desktop', '1440px desktop']
])
	for (const phase of ['before', 'after'])
		await store.record(report.id, {
			kind: 'evidence',
			data: {
				id: `${size}-${phase}`,
				title: `Settings ${phase}`,
				category: 'Settings',
				phase,
				comparison: 'settings',
				viewport,
				path: image,
				status: 'passed',
				capturedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
				note: `Synthetic report UI test fixture\n\n${viewport}: ${phase}`
			}
		});
await store.record(report.id, {
	kind: 'evidence',
	data: {
		id: 'camera-mobile',
		title: 'Camera controls',
		category: 'Camera',
		phase: 'current',
		viewport: '390px mobile',
		path: image,
		status: 'passed',
		capturedAt: new Date(Date.now() - 60 * 60_000).toISOString()
	}
});
const mobileOnly = await store.begin({
	project: '/tmp/alpha-project',
	title: 'Mobile-only review',
	mode: 'feature',
	environment: 'local fixture'
});
await store.record(mobileOnly.id, {
	kind: 'evidence',
	data: {
		id: 'mobile-only',
		title: 'Mobile field view',
		category: 'Field',
		phase: 'current',
		viewport: '390px mobile',
		path: image,
		status: 'passed'
	}
});
await store.begin({
	project: '/tmp/beta-project',
	title: 'Whole-site review',
	mode: 'suite',
	environment: 'local fixture'
});
await writeFile(join(root, 'fixture-id'), report.id);
await writeFile(join(root, 'mobile-id'), mobileOnly.id);
