// @harness-uid u_uchzbpfigk
export const trackerAutomationBrowserRule = `## Automation Chrome (primary Mac)

On daniel-primary-mbp, run CDP or Playwright browser work in the dedicated automation Chrome at http://127.0.0.1:9333. It never asks Daniel to click Allow. Check it with \`curl -s http://127.0.0.1:9333/json/version\`; if it is down, run \`launchctl kickstart -k gui/$(id -u)/com.daniel.automation-chrome\`.

It is shared: open your own tabs, close only those, and never close the browser, clear cookies or storage, or expose the port beyond loopback. Never read cookies, storage or auth headers.

It does not have the logins from Daniel's main Chrome. Sign in only through the Credential Vault with a reviewed script-only step. If no such step reaches this browser, flag that blocker. Do not turn on or ask for remote debugging in Daniel's main Chrome (port 9222), and do not copy its cookies or profile.`;
