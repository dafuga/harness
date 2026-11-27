---
status: planned
shippedIn: null
unitIds:
  - command.agents-providers-xdigest
  - service.agents-providers-xdigest
  - service.agents-providers-xdigest-send
  - service.agents-providers-xfeed-reader
owner: null
reviewedAt: null
---

# X digest

`harness x-digest` reads the owner's X Following, For you and mentions in a
[container browser](container-browser.md) and sends one daily digest to their
Slack direct message. It is the first user of that adapter.

## Two computers, no copied token

Credentials are not copied between computers, so the work is split:

| Step               | Runs on                                | Does                                                             |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| `x-digest collect` | the browser's Mac, 08:00               | reads X and writes the finished messages to an owner-only outbox |
| `x-digest send`    | the Mac that can read the token, 08:05 | pulls the day's file over SSH and posts it                       |

The collecting Mac never holds a Slack token. The sender reads it from Google
Secret Manager into its own process at send time and writes it nowhere. The
fetched file is untrusted: it must carry today's date and bounded messages, and
it cannot name a destination. The one direct message comes from the sender's own
config. The host and path it reads are limited to characters a shell cannot
interpret.

## Read only

The reader opens `x.com/home` and `x.com/notifications/mentions`, reads the posts
on screen, scrolls, and switches between the two home tabs. It has no code that
likes, reposts, replies, follows or composes, and its one click is a home tab.

## Sign-in and checks

Signed-in state is judged from a tab's address alone. A tab on a sign-in or
verification address, or on another site, is never attached to, navigated or
evaluated, so the owner's sign-in is never read. Harness types no credential.
When X wants a person, the collector raises one tracker question with the viewer
address and does not repeat it until the state changes. It also tells the sender,
which then stays quiet. While someone is watching through the viewer the
collector waits (`--wait`, 60 minutes by default).

## Digest

No model reads the feed, so post text cannot instruct anything. Ads are skipped.
Mentions are listed in order; Following and For you are ranked by
`likes + 3 × reposts + 2 × replies`. A post is queued once. Post text is escaped
so it cannot mention, link or format in Slack; the only links are post addresses
built from validated ids. An empty home feed is reported as an error, never as a
quiet day. State keeps post ids only; the outbox keeps one week of messages.
Both commands print a status and counts, never feed content.

The sender goes through the Slack platform adapter with a send-only binding
(no app id, cannot receive), allowlisted to one direct message id; a channel id is
refused. It waits up to 90 minutes for the day's file. One digest is posted per
Lisbon day. A refused message can be retried and resumes where it stopped. Once a
delivery is unknown the day is closed, so nothing is posted twice. A crash, or a
digest that never arrives, raises a tracker question.

## Install

On the browser's Mac, `~/.config/harness-x-digest/config.json`:

```json
{
	"profile": "x",
	"viewer": { "url": "http://<tailnet name>:6080", "port": 6080, "hosts": ["<tailnet name>"] },
	"tracker": { "item": "<id>", "command": "/Users/<user>/.local/bin/tracker" }
}
```

```sh
harness container-browser setup --profile x
deploy/x-digest/install.sh <tailnet name> <tailnet ip>
```

On the sending Mac, `~/.config/harness-x-digest/sender.json` (ids and the
secret's name, never its value):

```json
{
	"source": { "host": "<ssh name of the browser's Mac>" },
	"slack": {
		"installation": {
			"installationId": "x-digest",
			"project": "harness",
			"environment": "local",
			"workspaceId": "T…",
			"botId": "B…",
			"botUserId": "U…"
		},
		"channel": "D…",
		"secret": { "project": "<gcp project>", "name": "<secret name>" }
	},
	"tracker": { "item": "<id>", "command": "/Users/<user>/.local/bin/tracker" }
}
```

`x-digest identity --config sender.json` prints the bot's `botId` from
`auth.test` (put any well-formed `B…` there for that first call), then:

```sh
deploy/x-digest/install-sender.sh
```

Rollback: `launchctl bootout gui/$(id -u)/com.harness.x-digest.sender` on the
sending Mac, and `.daily` and `.viewer` on the browser's Mac, then
`harness container-browser down --profile x`. The saved sign-in is the Docker
volume `harness-browser-x-profile`.
