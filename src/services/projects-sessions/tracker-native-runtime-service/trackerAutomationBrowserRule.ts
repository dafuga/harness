// @harness-uid u_uchzbpfigk
export const trackerAutomationBrowserRule = `## Automation Chrome (primary Mac)

On daniel-primary-mbp, run CDP or Playwright browser work in the dedicated automation Chrome at http://127.0.0.1:9333. It never asks Daniel to click Allow. Check it with \`curl -s http://127.0.0.1:9333/json/version\`; if it is down, run \`launchctl kickstart -k gui/$(id -u)/com.daniel.automation-chrome\`.

It is shared: open your own tabs, close only those, and never close the browser, clear cookies or storage, or expose the port beyond loopback. Never read cookies, storage or auth headers.

It does not have the logins from Daniel's main Chrome. Sign in only through the Credential Vault with a reviewed script-only step. For GitHub and Slack, run \`~/.local/bin/automation-signin request github\` (or \`slack\`). It exits at once if the browser is already signed in. Otherwise it waits for Daniel's Face ID on the phone, so flag your item with that exact approval as you start it (a second request follows if the site asks for a code). If no such step exists for a site, flag that blocker. Do not turn on or ask for remote debugging in Daniel's main Chrome (port 9222), and do not copy its cookies or profile.

For a sensitive form whose rendered viewport is safe to show, use the screenshot-only helper in a verified Harness checkout (scripts/tracker-screenshot-browser.md). It opens its own automation tab and exposes only viewport screenshots, coordinate clicks, and ordinary text input. Skip the regular computer-use app opener and page inspection for this route. Use the Credential Vault script-only route for any step that can reveal a secret. If the form is only reachable from Daniel's existing Chrome tab or needs sign-in that has no Vault route, alert Chief of Staff before opening it.`;
