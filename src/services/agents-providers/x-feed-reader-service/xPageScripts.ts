// @harness-uid u_ven2ilzl74
/**
 * The only JavaScript run in X pages. It reads the posts on screen, scrolls, and switches between
 * the two home tabs. It never touches a post's like, repost, reply, follow or compose controls.
 */
export const readPostsScript = `(() => Array.from(
	document.querySelectorAll('article[data-testid="tweet"]'),
	(article) => {
		const link = article.querySelector('a[href*="/status/"] time')?.closest('a');
		const path = link?.getAttribute('href') ?? '';
		const found = /^\\/([A-Za-z0-9_]{1,15})\\/status\\/(\\d{1,25})/.exec(path);
		const labels = article.querySelector('[role="group"][aria-label]')?.getAttribute('aria-label');
		return {
			id: found?.[2] ?? '',
			author: found?.[1] ?? '',
			name: (article.querySelector('[data-testid="User-Name"] span')?.textContent ?? '').slice(0, 80),
			text: (article.querySelector('[data-testid="tweetText"]')?.innerText ?? '').slice(0, 1000),
			counts: (labels ?? '').slice(0, 300)
		};
	}
))()`;

export const scrollScript = 'window.scrollBy(0, Math.round(window.innerHeight * 0.85))';

export const siteCheckScript = `Boolean(document.querySelector(
	'iframe[src*="arkoselabs"], iframe[src*="captcha"], #arkose_iframe'
))`;

/** Home tabs in X's order. Clicking the selected tab again would open a menu, so it is skipped. */
export function selectHomeTabScript(index: 0 | 1): string {
	return `(() => {
	const tab = document.querySelectorAll('main [role="tablist"] [role="tab"]')[${index}];
	if (!tab) return 'missing';
	if (tab.getAttribute('aria-selected') === 'true') return 'selected';
	tab.click();
	return 'clicked';
})()`;
}
