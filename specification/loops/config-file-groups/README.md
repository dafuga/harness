# Config table proof

The original test-first checkpoint is preserved at `bd8bfd04348a11237ad2d2df8afb677377338815` with record `7bf6fe88032cc582c38e4887e8fcab86608e1fa99e370a50d23d30f7b64ebd49`.

Integrating main changed the complete frozen test corpus and config runner addresses. The evidence guard correctly refused to pair that original checkpoint with the integrated repair. Its green and verification steps remain pending rather than misrepresenting an unchanged run.

`config-file-groups-integrated` records the replacement prevention proof. In this isolated worktree, reintroducing only responsibility-based grouping fails all three standard viewport cases. Restoring source-file grouping passes the identical tests, fixtures, command and runtime profile. Original records and tested commits remain retained in Git evidence and source archive refs.

Full CLI and native suites are deferred by Daniel. A later main integration requires fresh affected checks and an independent capture from its final committed tree.
