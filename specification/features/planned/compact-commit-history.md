# Compact commit history

History lists Date, Commit, Behavior change, Size, Complexity and Latency. Commit hashes open the entity at that revision, retaining helper identity. Dates use relative words and expose the exact date on hover. Remove the selected-change panel, attempts column, evidence column and redundant revision links. Full long reasons remain available inline in their row.

Source measurements from the exact revision fill missing size and complexity without requiring a verification record. Recorded latency stays tied to its revision, workload and machine profile; unavailable latency stays explicit and never borrows a later result. Rebuild the shown historical source measurements without rewriting commits.

Existing standard history tests required the older panel and duplicate controls. Extend these cases for the compact schema, navigation, date titles and source-only measurements. Keep long-note disclosures and historical scoping covered.
