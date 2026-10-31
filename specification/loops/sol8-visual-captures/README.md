# Preview artwork coverage

The current-code API preflight at 84fdff901d confirms that the revision labels and
mobile contract layout in items 35–36 are already corrected. The module-card,
modal and usage artwork still paints fixture labels. Existing assertions required
those labels and the synthetic modal caption, so they accepted the rejected data.

The standard catalog now checks loaded SVG content, image alternatives and captions
after retaining the component screenshot. Its cases and viewport count stay fixed.
Fixture provenance remains in source comments and evidence metadata.

The failure capture proves the new guard rejects the old inputs. Correcting the
artwork and the old positive copy assertions changes the test corpus, so subsequent
passing captures are fixture qualification, not a matched product red/green pair.
No runtime component repair is claimed for these image-data corrections. Item 40's
table rendering defects have their own product regression loop.

Item 42's empty-configs state delegates to the repaired ExplorerTable. Its old
assertion required zero body rows, so it must now require the spanning empty cell
before current-code refetching. This is an assertion correction for item 40's
existing repair, not a new product change. Current captures will establish whether
the local SearchBox artwork and View More hover still need correction.

Current-code item 42 preflight `6069804c9f77` retains twelve API images. Inspection
confirms the hovered pagination background differs from the transparent default,
and empty-configs already shows its aligned message. Only the local SearchBox SVG
still paints a fixture label. The standard artwork guard now covers every catalog
variant, and pagination assertions retain the visible background distinction.
The guard must reject the old multiple-card images before the fixture label changes.
That fixture qualification is separate from the matched product loops.
