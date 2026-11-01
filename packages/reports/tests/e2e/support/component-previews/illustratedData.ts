import type { Data } from './illustratedData.types';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { bound } from '../../../../../desktop/tests/e2e/ui-evidence-bindings';
/** Representative Orders input; its fixture provenance stays in capture metadata. */
function exampleScreen(position: number): Buffer {
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560">
<rect width="920" height="560" fill="#0e1c29"/>
<g font-family="sans-serif" fill="#f4f7fb">
<text x="40" y="108" font-size="32">Orders</text>
<text x="40" y="148" font-size="19" fill="#a4b7ca">Recent orders ready to review</text>
<rect x="40" y="182" width="840" height="66" rx="10" fill="#192f42"/>
<text x="60" y="224" font-size="22">Order ${1041 + position} · Keyboard</text>
<text x="710" y="224" font-size="19" fill="#87d8b0">Ready</text>
<rect x="40" y="264" width="840" height="66" rx="10" fill="#192f42"/>
<text x="60" y="306" font-size="22">Order ${1077 + position} · Service plan</text>
<text x="710" y="306" font-size="19" fill="#f3c33b">Pending</text>
<rect x="40" y="364" width="216" height="52" rx="8" fill="#254153"/>
<text x="62" y="398" font-size="19">Review all orders</text>
</g></svg>`);
}

/** Reseal this preview's synthetic bytes and references; leave the standard integrity fixtures intact. */
export async function illustratedData(original: Data): Promise<Data> {
	const pictures = Object.entries(original.bytes).filter(([, value]) =>
		value.mediaType.startsWith('image/')
	);
	const samples = await renderSamples(pictures.map(([hash]) => hash));
	const replacements = samples.map(({ hash, bytes }) => ({
		hash,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		bytes
	}));
	let text = JSON.stringify(original);
	for (const item of replacements) text = text.replaceAll(item.hash, item.sha256);
	const result = JSON.parse(text) as Data;
	for (const item of replacements)
		result.bytes[item.sha256] = { mediaType: 'image/png', data: [...item.bytes] };
	result.design = [...samples[0].bytes];
	return result;
}

/** Render readable sample inputs as PNGs; these are never claimed as captures of a project UI. */
async function renderSamples(hashes: string[]) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: { width: 920, height: 560 } });
		const samples = [];
		for (const [position, hash] of hashes.entries()) {
			await page.setContent(exampleScreen(position).toString());
			await page.evaluate(() => document.fonts.ready);
			const bytes = await page.locator('svg').screenshot({ animations: 'disabled' });
			samples.push({ hash, bytes });
		}
		return samples;
	} finally {
		await browser.close();
	}
}

/** Dedicated comparison inputs preserve every other catalog illustration and its original bytes. */
export async function desktopScreenFixtures(original: Data) {
	const bytes: Data['bytes'] = {};
	const bindings: Data['bindings'] = {};
	const results: Data['results'] = {};
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		for (const name of ['paired', 'incomparable']) {
			const unit = name === 'paired' ? 'app.page.orders' : 'app.component.order-card';
			const key = `${unit}|commit|${original.tip}`;
			const result = structuredClone(original.results[key]);
			const scenario = name === 'paired' ? 'orders-page' : 'order-card';
			result.evidence.scenarios = result.evidence.scenarios
				.filter((item) => item.id === scenario)
				.map((item) => ({
					...item,
					title: name === 'paired' ? 'Orders list' : 'Order card alone'
				}));
			for (const side of ['before', 'after'] as const) {
				const value = result.evidence[side]!;
				value.captures = value.captures.filter((item) => item.scenario === scenario);
				const width = name === 'incomparable' && side === 'after' ? 1280 : 1440;
				await page.setViewportSize({ width, height: 900 });
				await page.setContent(comparisonScreen(width, side === 'after', name === 'paired'));
				await page.evaluate(() => document.fonts.ready);
				const data = await page.locator('svg').screenshot({ animations: 'disabled' });
				const hash = createHash('sha256').update(data).digest('hex');
				const old = value.captures[0].capture.sha256;
				freshComparison(value, scenario);
				result.evidence[side] = JSON.parse(JSON.stringify(value).replaceAll(old, hash));
				bytes[hash] = { mediaType: 'image/png', data: [...data] };
			}
			results[`screen-${name}`] = result;
			Object.assign(bindings, Object.fromEntries(bound(result, 'commit', unit, original.branch)));
		}
	} finally {
		await browser.close();
	}
	return { results, bytes, bindings };
}

function comparisonScreen(width: number, after: boolean, list: boolean) {
	const status = after ? 'Ready' : 'Pending';
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="900" viewBox="0 0 ${width} 900">
<rect width="${width}" height="900" fill="#0e1c29"/>
<g font-family="sans-serif" fill="#f4f7fb">
<text x="56" y="110" font-size="40">${list ? 'Orders' : 'Order 1041 · Keyboard'}</text>
<text x="56" y="162" font-size="24" fill="#a4b7ca">${list ? 'Recent orders ready to review' : 'Fulfilment and delivery'}</text>
<rect x="56" y="210" width="${width - 112}" height="100" rx="12" fill="#192f42"/>
<text x="82" y="270" font-size="30">${list ? 'Order 1041 · Keyboard' : 'Keyboard · 1 item'}</text>
<text x="${width - 260}" y="270" font-size="28" fill="${after ? '#87d8b0' : '#f3c33b'}">${status}</text>
${
	list
		? `<rect x="56" y="340" width="${width - 112}" height="100" rx="12" fill="#192f42"/>
<text x="82" y="400" font-size="30">Order 1077 · Service plan</text>
<text x="${width - 260}" y="400" font-size="28" fill="#f3c33b">Pending</text>`
		: ''
}
${
	after && list
		? `<rect x="56" y="470" width="${width - 112}" height="100" rx="12" fill="#192f42"/>
<text x="82" y="530" font-size="30">Order 1088 · Delivery</text>
<text x="${width - 260}" y="530" font-size="28" fill="#87d8b0">Confirmed</text>`
		: ''
}
</g></svg>`;
}

function freshComparison(
	value: NonNullable<Data['results'][string]['evidence']['after']>,
	scenario: string
) {
	for (const found of value.captures) {
		found.current = true;
		found.standing = 'fresh';
		found.inheritedFrom = null;
		if (found.capture.server) found.capture.server.revision = value.commit;
	}
	const record = value.record!;
	for (const entry of record.scenarios.filter((item) => item.id === scenario)) {
		entry.inherited = false;
		entry.testedRevision = value.commit;
		entry.origin = { ...entry.origin, record: record.id, commit: value.commit };
	}
	if (value.detail) value.detail.records = [record];
}
