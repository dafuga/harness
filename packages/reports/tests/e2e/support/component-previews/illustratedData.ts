import type { Data } from './illustratedData.types';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import type { evidenceData } from '../../../../../desktop/tests/e2e/ui-evidence-data';
/** Representative image input for screenshot viewers, explicitly labeled as synthetic content. */
function exampleScreen(label: string): Buffer {
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="920" height="560" viewBox="0 0 920 560">
<rect width="920" height="560" fill="#0e1c29"/>
<g font-family="sans-serif" fill="#f4f7fb">
<text x="40" y="48" font-size="16" fill="#a4b7ca">SYNTHETIC PREVIEW INPUT · ${label}</text>
<text x="40" y="108" font-size="32">Orders</text>
<text x="40" y="148" font-size="19" fill="#a4b7ca">Recent orders ready to review</text>
<rect x="40" y="182" width="840" height="66" rx="10" fill="#192f42"/>
<text x="60" y="224" font-size="22">Order 1041 · Keyboard</text>
<text x="710" y="224" font-size="19" fill="#87d8b0">Ready</text>
<rect x="40" y="264" width="840" height="66" rx="10" fill="#192f42"/>
<text x="60" y="306" font-size="22">Order 1077 · Service plan</text>
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
		for (const hash of hashes) {
			await page.setContent(exampleScreen(hash.slice(0, 7)).toString());
			await page.evaluate(() => document.fonts.ready);
			const bytes = await page.locator('svg').screenshot({ animations: 'disabled' });
			samples.push({ hash, bytes });
		}
		return samples;
	} finally {
		await browser.close();
	}
}
