import type { Guide } from '../development-tooling/guide';

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
		'Branches of code are the local ones and those a clone has only from its remotes. A ' +
			'remote-only branch keeps its plain name when the remotes agree on its tip; a remote tip ' +
			'that differs from the local branch of that name is listed beside it as <remote>:<branch>, ' +
			'which no local branch can be called, and a local branch is never moved to it.',
		'A record is attached only if its seal, its files and its commit and tree all check out. ' +
			'A failed record is attached as failed. The records it inherits from, and those the ' +
			'budget ledger cites, are attached with it.',
		'Screenshots and audio are stored through Git LFS with the hash and size of the original ' +
			'bytes. No LFS filter has to be installed.',
		'Inspect a captured image before explicitly recording its reviewer and reason with ' +
			'history screenshot review. A review retains the original case, build, revision and ' +
			'run outcome; it does not change a failed run to passed.',
		'history screenshot read validates the review and original evidence again and writes only ' +
			'to a new file. A missing, altered or wrong-case baseline is an error.',
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
		'Do not edit a note to change an outcome.',
		'Do not automatically approve a missing or changed screenshot.'
	],
	exampleCommands: [
		'harness history attach',
		'harness history attach --commit HEAD~1 --record <id>',
		'harness history reasons --base <rev> --commit <rev>',
		'harness history status --commit HEAD --json',
		'harness history screenshot review --commit <hash> --record <id> --unit <id> --case <id> ' +
			'--scenario <id> --evidence <id> --viewport <id> --reviewer <name> --reason <text>',
		'harness history screenshot read --id <id> --unit <id> --case <id> --viewport <id> ' +
			'--file <authored-path> --out <new-path>',
		'harness history fetch origin',
		'harness history sync origin',
		'harness history build --out .cache/harness/history --strict',
		'harness history import-reports --from ~/.codex/project-reports'
	]
};

const hooksGuide: Guide = {
	topic: 'hooks',
	summary:
		'Opt-in hooks: a pushed commit needs a passing verification, and a commit message keeps the writing limits.',
	steps: [
		'Run harness hooks install --command "<how this worktree starts harness>".',
		'Commit as usual; a message over the limits or without its prefix is refused before the commit exists.',
		'Push as usual; each pushed branch tip is checked, and verified in a clean snapshot if needed.',
		'Run harness history sync origin to publish the attached evidence; the hook does not.',
		'Run harness hooks status to see what is installed, and harness hooks uninstall to remove it.'
	],
	rules: [
		'Two stages are offered: pre-push and commit-msg. Before a commit exists there is no exact ' +
			'revision to verify, so commit-msg measures the message and nothing else.',
		'A commit message has a subject of at most 72 characters that starts with feat:, fix:, ' +
			'chore: or cleanup:, and an optional body, trailers included, of at most 60 words and 400 ' +
			'characters.',
		'A message is measured only where the repository declares "writing" in harness.verify.json, ' +
			'as 1 or 2: both hold a message to the same limits. Commits of evidence are never measured.',
		'The commit-msg hook reads the message file as Git will store it and reads no input: ' +
			'comments are left out of a message an editor was opened for, and a line that starts with ' +
			'a hash is counted in one given with -m. A cleanup mode given on the command line is not ' +
			'told to a hook.',
		'Verification measures the stored message of every source commit it newly reaches, also ' +
			'those a merge brings in, and counts every line of it.',
		'The hook verifies the commit being pushed, exported from Git into a clean directory, so ' +
			'uncommitted work in the worktree is never part of it.',
		'A failed or incomplete verification blocks the push and its record is attached as failed.',
		'An existing hook is kept beside the wrapper and runs first; if it fails, the push stops.',
		'The hooks directory is shared by all worktrees. A wrapper acts only in a worktree that ' +
			'opted into its stage; the others behave as before.',
		'Each stage has an opt-in file of its own in the Git directory of the worktree: ' +
			'harness-hooks for pre-push, as every version wrote it, and harness-hooks-<stage> for a ' +
			'stage offered later. The opt-in of one stage never starts another.',
		'A worktree that ran harness hooks install under an earlier Harness keeps the stages it ' +
			'asked for then. A stage offered later starts there only after the command is run there ' +
			'again; harness hooks status says which stages are enabled.',
		'Pushes of evidence, notes, archived source, tags and deletions are not verified.',
		'When core.hooksPath points into the working tree, another tool owns the hooks and nothing ' +
			'is installed.'
	],
	antiPatterns: [
		'Do not rely on the hooks alone: --no-verify skips them. CI checks every push, and a ' +
			'message that skipped the hook fails the verification of its commit.',
		'Do not put an inventory of the change into a commit body: say what changed and why, briefly.',
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
