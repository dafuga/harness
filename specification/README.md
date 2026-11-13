# Feature document metadata

Feature documents start with YAML front matter. `status` reflects the document's existing
`planned` or `implemented` folder. Moving a file between those folders changes that classification;
it does not claim a release or deployment.

`shippedIn` is a release or revision only when the document has explicit shipment evidence. Use
`null` while that evidence is unknown. `unitIds` lists only units explicitly linked to the document
by a unit manifest's `documentation` field; use `[]` when no such link exists. A completed loop or
a passed verification record is a review signal, not shipment evidence.

`owner` and `reviewedAt` record accountable maintenance and the last review date. Keep either
`null` when the repository does not establish it. Run `bun scripts/report-feature-status.ts` to
report planned documents associated with completed loops or passed verification records, along
with missing owner and review-date evidence. This command reports only and does not change status.
