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
