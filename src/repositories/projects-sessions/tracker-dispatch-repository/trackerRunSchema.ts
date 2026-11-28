// @harness-uid u_ksy76trvsj
/** The pinned Tracker RunLog layout, shared by the legacy and native readers. */
export const trackerRunSchema = `
CREATE TABLE IF NOT EXISTS runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL, auto_token TEXT, attempt INTEGER NOT NULL DEFAULT 1,
  rung TEXT NOT NULL, cli TEXT NOT NULL, model TEXT NOT NULL, effort TEXT, pinned INTEGER NOT NULL DEFAULT 0,
  kind TEXT, project TEXT, repo TEXT, reason TEXT,
  state TEXT NOT NULL, outcome TEXT, failure_reason TEXT,
  queued_at INTEGER NOT NULL, started_at INTEGER, ended_at INTEGER, resumed_at INTEGER, eta_at INTEGER, kill_at INTEGER,
  tmux TEXT, session_name TEXT, session_id TEXT, exit_code INTEGER,
  escalated_from INTEGER, redone_by TEXT,
  input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER, cost_usd REAL, credits_balance TEXT,
  idle_nudges INTEGER NOT NULL DEFAULT 0, idle_nudged_at INTEGER, idle_escalated_at INTEGER, watch_pane TEXT, source_repo TEXT
);
CREATE INDEX IF NOT EXISTS runs_item ON runs(item_id, id);
CREATE INDEX IF NOT EXISTS runs_state ON runs(state);
CREATE TABLE IF NOT EXISTS run_host_work(
  run_id INTEGER NOT NULL, lease TEXT NOT NULL, host TEXT NOT NULL, kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL, PRIMARY KEY(run_id, lease)
);
CREATE TRIGGER IF NOT EXISTS run_host_work_finished AFTER UPDATE OF state, ended_at ON runs
WHEN NEW.state NOT IN ('running', 'verifying') OR NEW.ended_at IS NOT NULL
BEGIN
  DELETE FROM run_host_work WHERE run_id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS run_host_work_deleted AFTER DELETE ON runs
BEGIN
  DELETE FROM run_host_work WHERE run_id = OLD.id;
END;
-- Finished runs from other computers (Mac runners report theirs to the hub; the
-- hub sends its history back), so history and reports cover all computers.
CREATE TABLE IF NOT EXISTS remote_runs(
  node TEXT NOT NULL, id INTEGER NOT NULL, item_id TEXT, attempt INTEGER, rung TEXT, cli TEXT, model TEXT,
  effort TEXT, pinned INTEGER NOT NULL DEFAULT 0, kind TEXT, project TEXT, state TEXT, outcome TEXT,
  failure_reason TEXT, queued_at INTEGER, started_at INTEGER, ended_at INTEGER, resumed_at INTEGER, redone_by TEXT,
  input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER, cost_usd REAL,
  auto_token TEXT, tmux TEXT, session_name TEXT, session_id TEXT, escalated_from INTEGER, credits_balance TEXT,
  idle_nudges INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(node, id)
);
CREATE INDEX IF NOT EXISTS remote_runs_item ON remote_runs(item_id, auto_token);
CREATE TABLE IF NOT EXISTS launch_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, kind TEXT NOT NULL,
  item_id TEXT, run_id INTEGER, text TEXT NOT NULL, batched INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_watch_pane ON runs(watch_pane) WHERE watch_pane IS NOT NULL;
`;
