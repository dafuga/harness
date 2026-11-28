# Screenshot-only control for automation Chrome

Use this helper on the primary Mac with the dedicated automation Chrome on loopback port 9333. It opens one tab at a known public HTTPS origin. Reach the form through ordinary clicks inside that tab. Use the approved Credential Vault sign-in route if the automation profile needs a login. Ask Chief of Staff when a site lacks that route or the workflow depends on a tab in Daniel's Chrome.

The helper returns page viewport PNGs and accepts clicks and ordinary form text. Chrome captures the viewport directly, so the shell needs no Screen Recording permission. Browser chrome and the address bar are outside the capture. The helper requests no accessibility tree, DOM, URL or tab inventory, cookies, console logs, or network data. It exposes fixed errors and closes only the tab it created.

Use the route when credentials stay out of the rendered page. If a page can show a secret in the viewport or an action can reveal one, use the reviewed script-only Vault path. Type only nonsecret form data. Keep screenshots in memory and return them as images through the tool.

In a persistent Node REPL with Node 22.18 or later, load the helper from the verified Harness checkout. Use a fresh screenshot for coordinates after the page moves or changes size.

```js
const { openScreenshotBrowser } =
	await import('/absolute/path/to/harness/scripts/tracker-screenshot-browser.ts');
const page = await openScreenshotBrowser('https://example.invalid');
await nodeRepl.emitImage({ bytes: await page.screenshot(), mimeType: 'image/png' });
// Choose these coordinates from the screenshot.
await page.click(120, 240);
await page.type('Nonsecret form text');
await page.close();
```

Close the tab explicitly when work finishes or pauses, including after an input or capture error. Keep the same REPL session until it confirms closure.
