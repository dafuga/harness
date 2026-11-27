// @harness-uid u_uchzbpfigk
export const trackerAutomationBrowserRule = `## Automation Chrome (primary Mac)

On daniel-primary-mbp, run CDP or Playwright browser work in the dedicated automation Chrome at http://127.0.0.1:9333. It never asks Daniel to click Allow. Check it with \`curl -s http://127.0.0.1:9333/json/version\`; if it is down, run \`launchctl kickstart -k gui/$(id -u)/com.daniel.automation-chrome\`.

It is shared: open your own tabs, close only those, and never close the browser, clear cookies or storage, or expose the port beyond loopback. Never read cookies, storage or auth headers.

It does not have the logins from Daniel's main Chrome. Sign in only through the Credential Vault with a reviewed script-only step. For GitHub and Slack, run \`~/.local/bin/automation-signin request github\` (or \`slack\`). It exits at once if the browser is already signed in. Otherwise it waits for Daniel's Face ID on the phone, so flag your item with that exact approval as you start it (a second request follows if the site asks for a code). If no such step exists for a site, flag that blocker. Do not turn on or ask for remote debugging in Daniel's main Chrome (port 9222), and do not copy its cookies or profile.`;
