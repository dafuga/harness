# Secret creation and rotation recipes

Bind every run to the approved provider account, project, target environment, scope and
destination. The operator reviews the producer and destination commands or the browser
recipe and sink binding before the action. Keep request bodies, response bodies, traces,
screenshots, browser video, clipboard and debug logging out of the run. A receipt can
include the non-secret credential ID, scope, store name, version and verification result.

## Google OAuth web client

Use the Credential Vault's disposable browser for Google Auth Platform → Clients. Prepare
branding and audience ahead of time and verify the exact project and Google account in the
script. Select Web application and set the approved origins and redirect URIs. The script
owns the final **Create** click and reads the generated client ID and secret from the
resulting dialog on the expected origin. For a server-side token exchange, pass just the
secret to the backend's configured secret store. For browser-only Google Identity Services,
return only the client ID and close the dialog without extracting the unused secret. Store
no client JSON in Downloads. If the console requires a download, qualify a script that uses
an in-container stream or private tmpfs, validates the expected client ID and extracts
only the necessary field before wiping it. Destroy the browser before returning any
receipt. [Google OAuth setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)

## Stripe

- **API key.** In the authenticated disposable browser confirm the account and test or
  live mode before creating a restricted key or revealing an existing permitted secret.
  Capture the unmasked value directly from the result and write it to the scoped Stripe
  API-key binding. Check the assigned permissions and confirm an allowed read with the
  deployed secret. [Stripe API keys](https://docs.stripe.com/keys)
- **Webhook signing secret.** Use the authorized Stripe API to create the endpoint when
  applicable. Pass the creation response's `secret` to the receiver's signing-secret
  binding and keep the endpoint ID for verification. For an existing endpoint or a
  Dashboard-only rotation, use the script-only browser on the exact endpoint and mode.
  Validate a synthetic event signature through the normal receiver. Do not substitute a
  local Stripe CLI listener secret for a Dashboard endpoint secret.
  [Stripe webhook API](https://docs.stripe.com/api/webhook_endpoints/create)

## Cloudflare

Use a project- and account-scoped token issuer and send the create-token response's
`result.value` to the destination. Pin whether the token is user-owned or account-owned
and validate its allowed resources, permissions and expiry. Use the script-only browser
to bootstrap an approved token when no safe issuer exists. Return the token ID only.
[Cloudflare token creation API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/)

## OpenAI

For automation, prefer a service account in the exact project and create its scoped,
expiring key with the Admin API from the executor's approved identity. The new key
response's `value` goes directly to the store. For an approved dashboard-only user key,
script the project selector, creation and one-time reveal in the disposable browser.
Verify scope and registration through metadata without a model request.
[OpenAI API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## Twilio

Bind the correct account or subaccount and region. Use the Key Resource v1 API for a
supported Standard or Restricted key. Write `secret` into the writer bound to that
project and pair it with the returned non-secret `sid`. For a console-only action the
runner captures the secret from the one-time result. Keep Account SIDs and Key SIDs
separate from tokens and key secrets. [Twilio Key Resource v1](https://www.twilio.com/docs/iam/api-keys/key-resource-v1)

## npm

Use the supported granular `npm token create` CLI or the runner's npm website recipe.
Limit packages or organizations and expiry. Use the CLI's structured output inside the
private producer to emit only the newly issued token to the relay. Route OTP through
the Vault; if the CLI needs model-visible interaction or cannot return machine-readable
output for that version, use the reviewed browser route. Verify metadata and target
access privately before revoking an old token. [npm token](https://docs.npmjs.com/cli/v11/commands/npm-token/)

## Slack bot token (BuildFlexity Alerts)

Pinned binding `harness/slack-smoke/buildflexity-alerts/bot@1`: app `A0CM4RZ3508`, workspace
`T0CHRK2DS0M`, destination channel `C0CL8D6PCLS`. Run `deploy/vault/slack_bot_token.py` as the
producer and `deploy/vault/slack_binding.py store` as the writer through `secret_pipe.transfer`
with recipe `slack-bot-token`. The producer reads one private 0600 packet file (the bot token
from the app's approved OAuth install, as either the `oauth.v2.access` result or `{"token"}`),
deletes it, and checks the app, workspace, `bot` token type, `chat:write` grant and, through
`auth.test`, the bot ID and bot-user ID. A bare token needs `--expect-bot-id` and
`--expect-bot-user-id` because `auth.test` does not return the app ID. With `groups:read` it also
checks that the bot is a member of the private channel. Without it the receipt says
`unverified-no-groups-read`, and the one send fails safe with `not_in_channel` if the bot was
never invited. The producer writes only IDs, the grant and PASS or FAIL to `--receipt` (0600).
The writer refuses any receipt that is not a PASS for the pinned app, workspace and channel.

The store keeps `bot.token` and `bot.receipt.json` at mode 0600 under
`<root>/harness/slack-smoke/buildflexity-alerts/` (an owner-only directory). The smoke
consumer reads `python3 deploy/vault/slack_binding.py emit <root>`, which re-checks the receipt and
prints the `{"token"}` packet for a private pipe. Obtaining the token live (OAuth install and
reveal) needs Daniel's approval and a reviewed live recipe. The synthetic tests cover only
the producer, the pins and the store.
[Slack OAuth exchange](https://docs.slack.dev/reference/methods/oauth.v2.access/)
· [auth.test](https://docs.slack.dev/reference/methods/auth.test/)

## Bind the destination

- Run the reviewed producer and writer through `deploy/vault/secret_pipe.py` from the
  trusted executor. It waits for successful production before feeding the writer's
  stdin. Pass the recipe name to select a single credential field from a private
  JSON response. Accepted names are `google-oauth-web-client`, `stripe-webhook`,
  `cloudflare-token`, `openai-service-account-key`, `twilio-key`, `npm-token`, and
  `slack-bot-token`.
  For a reviewed raw producer omit the recipe and emit exactly the bytes the writer expects.
- For a Worker use `wrangler secret put NAME --env ENV` through the correct account
  profile. For GitHub use `gh secret set NAME --repo OWNER/REPO --env ENV` with stdin.
  For Google Secret Manager, use an existing scoped secret with
  `gcloud secrets versions add NAME --project PROJECT --data-file=-`.
  [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/general/)
  · [GitHub CLI](https://cli.github.com/manual/gh_secret_set)
  · [gcloud Secret Manager](https://docs.cloud.google.com/sdk/gcloud/reference/secrets/versions/add)
- For macOS Keychain use a reviewed stdin reader that writes via Security.framework
  under the intended service and account. Keep values out of `security` CLI arguments.
- For browser capture, the signed script declares the trigger, exact result path and
  secret locator. The executor resolves its sink from the approved recipe digest and
  write action before login. Scope the browser to the provider, disable attachment and
  recording, and destroy it in the executor's finally block. A failed write after
  creation leaves provider state uncertain. Check the provider or revoke the orphaned
  credential through the executor before retrying.

These are operator recipes. The current Harness browser executor admits synthetic
`.test` origins. Live adapters need provider-specific identity checks, signed selectors,
approval and destination bindings before enablement.
