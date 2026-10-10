import type { Guide } from './guide';

const historyGuide: Guide = {
	topic: 'history',
	summary: 'Keep verification records, evidence and reasons in Git and rebuild history from it.',
	steps: [
		'Verify a commit, then run harness history attach to store its record and evidence.',
		'Run harness history status to see what Git alone proves about a commit.',
		'Run harness history sync origin to exchange records with a remote.',
		'Run harness history build --out <directory> to produce the portable history index.'
	],
	rules: [
		'The source commit is never changed: records and files go to the harness-evidence branch, ' +
			'a note on the commit in refs/notes/harness names them, and refs/harness/source/<sha> ' +
			'keeps the tested commit reachable after its branch is deleted or rewritten.',
		'A record is attached only if its seal, its files and its commit and tree all check out. ' +
			'A failed record is attached as failed. The records it inherits from, and those the ' +
			'budget ledger cites, are attached with it.',
		'Screenshots and audio are stored through Git LFS with the hash and size of the original ' +
			'bytes. No LFS filter has to be installed.',
		'Records are only added. Several runs of one commit, writers in one repository or in ' +
			'worktrees sharing it, and clones that diverged are all kept; sync merges and never forces.',
		'The sealed record states the outcome. A note is an index: a line written for another ' +
			'commit, or one that disagrees with its record, proves nothing.',
		'A record counts only with everything it inherits: its base record and the records behind ' +
			'referenced scenarios must be attached and intact, to the root.',
		'Evidence and notes are history about code, not code: they are never verified, never count ' +
			'as a change and never start a hook or CI run.',
		'The history index is built from Git alone and is deterministic. Commits without evidence ' +
			'are listed as gaps; missing or damaged data is reported, never substituted.',
		'Legacy reports are imported as recorded: original dates and outcomes, running stays ' +
			'running, a revision that is not a commit here stays unlinked, other projects are skipped.',
		'The local .cache is a rebuildable cache of what is attached, plus drafts not yet attached.'
	],
	antiPatterns: [
		'Do not force-push the evidence branch or notes.',
		'Do not copy notes to a rewritten commit; verify the new commit.',
		'Do not edit a note to change an outcome.'
	],
	exampleCommands: [
		'harness history attach',
		'harness history attach --commit HEAD~1 --record <id>',
		'harness history reasons --base <rev> --commit <rev>',
		'harness history status --commit HEAD --json',
		'harness history fetch origin',
		'harness history sync origin',
		'harness history build --out .cache/harness/history --strict',
		'harness history import-reports --from ~/.codex/project-reports'
	]
};

const hooksGuide: Guide = {
	topic: 'hooks',
	summary: 'An opt-in pre-push hook that requires a passing verification of what is pushed.',
	steps: [
		'Run harness hooks install --command "<how this worktree starts harness>".',
		'Push as usual; each pushed branch tip is checked, and verified in a clean snapshot if needed.',
		'Run harness history sync origin to publish the attached evidence; the hook does not.',
		'Run harness hooks status to see what is installed, and harness hooks uninstall to remove it.'
	],
	rules: [
		'Only pre-push is offered. Before a commit exists there is no exact revision to verify.',
		'The hook verifies the commit being pushed, exported from Git into a clean directory, so ' +
			'uncommitted work in the worktree is never part of it.',
		'A failed or incomplete verification blocks the push and its record is attached as failed.',
		'An existing hook is kept beside the wrapper and runs first; if it fails, the push stops.',
		'The hooks directory is shared by all worktrees. The wrapper acts only in worktrees that ' +
			'ran harness hooks install; the others behave as before.',
		'Pushes of evidence, notes, archived source, tags and deletions are not verified.',
		'When core.hooksPath points into the working tree, another tool owns the hooks and nothing ' +
			'is installed.'
	],
	antiPatterns: [
		'Do not rely on the hook alone: git push --no-verify skips it. CI checks every push.',
		'Do not install it in a checkout you do not own.'
	],
	exampleCommands: [
		'harness hooks install --command "bun run dev --"',
		'harness hooks status',
		'harness hooks uninstall'
	]
};

const ciGuide: Guide = {
	topic: 'ci',
	summary: 'CI verifies code without write access and publishes evidence from trusted code.',
	steps: [
		'harness-verify.yml runs the full check and verifies the exact commit, read-only.',
		'It uploads the record and its evidence as an artifact, pass or fail.',
		'harness-evidence.yml, on the default branch, validates that artifact and publishes it.'
	],
	rules: [
		'The workflow that runs the code under test has contents: read and uses no secrets.',
		'The publishing workflow never checks out, installs, builds or runs the verified commit. ' +
			'It validates the record as data: schema, seal, files, commit and tree.',
		'External actions are pinned to full commit hashes; Bun and Rust are pinned versions.',
		'Pushes to harness-evidence and to notes do not start a run.',
		'Performance budgets are judged only against a baseline reviewed for that machine profile. ' +
			'A runner without one fails the budget gate. CI never establishes or approves a baseline.',
		'Records of commits from other repositories are verified but not published.'
	],
	antiPatterns: [
		'Do not use pull_request_target or give the verifying job a write token.',
		'Do not let a workflow approve a budget.'
	],
	exampleCommands: [
		'harness verify run --commit "$COMMIT"',
		'harness history attach --commit "$COMMIT" --record <record.json>',
		'harness history sync origin'
	]
};

export const historyGuides: Guide[] = [historyGuide, hooksGuide, ciGuide];
