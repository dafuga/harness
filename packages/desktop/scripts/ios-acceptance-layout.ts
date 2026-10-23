import type { Measured } from './ios-acceptance-layout.types';
import { shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';

const measure = `
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden';
document.body.append(probe);
const inset = probe.getBoundingClientRect().height;
probe.remove();
const strip = getComputedStyle(document.body, '::before');
const page = [document.body, document.documentElement];
const beneath = [0.2, 0.5, 0.8].flatMap((x) => document.elementsFromPoint(innerWidth * x, inset * 0.6)).filter((item) => !page.includes(item));
const boxes = [...document.querySelectorAll('footer.status-bar > *')].map((item) => item.getBoundingClientRect()).filter((box) => box.height > 0);
return JSON.stringify({
	inset,
	scrolled: scrollY,
	strip: { fixed: strip.position === 'fixed', top: parseFloat(strip.top), height: parseFloat(strip.height), opaque: strip.backgroundColor.startsWith('rgb('), above: Number(strip.zIndex) },
	beneath: beneath.length,
	facts: boxes.length,
	stacked: boxes.every((box, index) => index === 0 || box.top >= boxes[index - 1].bottom - 1),
	aligned: new Set(boxes.map((box) => Math.round(box.left))).size === 1,
	fits: document.documentElement.scrollWidth <= innerWidth
});`;

async function measured(run: Acceptance): Promise<Measured> {
	return JSON.parse(await run.page.evaluate(measure)) as Measured;
}

function covers({ strip, inset }: Measured): boolean {
	const whole = strip.top === 0 && Math.abs(strip.height - inset) < 1;
	return strip.fixed && whole && strip.opaque && strip.above >= 1;
}

/** At the top of a connected page nothing of the page is in the safe area. */
export async function topLayout(run: Acceptance): Promise<void> {
	await run.page.evaluate("scrollTo(0, 0); return 'ok';");
	const found = await measured(run);
	run.record.check(
		found.inset > 20 && found.scrolled === 0 && found.beneath === 0,
		`at the top of the page nothing of it lies in the top safe area (${found.inset} px)`
	);
	await shot(run, 'connected-top');
}

/**
 * Scrolled down to the status bar: what moved up lies under the clock and is covered there, and
 * the narrow status bar is one column of facts.
 */
export async function scrolledLayout(run: Acceptance): Promise<void> {
	const { record, page } = run;
	const down = "document.querySelector('footer.status-bar').scrollIntoView({ block: 'end' });";
	await page.evaluate(`${down} return 'ok';`);
	const found = await measured(run);
	record.check(
		found.scrolled > 0 && found.beneath > 0,
		'scrolled down to the status bar, content of the page lies in the top safe area'
	);
	record.check(
		covers(found),
		'an opaque strip, fixed at the top and as tall as the safe area, is drawn above it'
	);
	record.check(
		found.facts >= 4 && found.stacked && found.aligned,
		`the narrow status bar is one column: ${found.facts} facts, each on its own line`
	);
	record.check(found.fits, 'the page is not wider than the screen');
	await shot(run, 'cached-scrolled');
}
