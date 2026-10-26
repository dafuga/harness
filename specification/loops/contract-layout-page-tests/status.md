# Layouts use the page test form

Layouts share the existing `page` screenshot form. Each declared state uses the
required desktop, tablet and mobile matrix, with a labelled Child content
placeholder rendered through the layout's real child slot. This does not add a
sixth test shape or automatically accept any screenshot baseline.

Repository instructions and the installed Harness and regression skills now
state this rule. Both installed skills passed the skill-creator static validator.
Existing generator, guidance and validator cases were strengthened without
adding test declarations or changing their registered titles.

Runtime implementation is pending its product-caused failing test. The current
scaffold guide still classifies layouts as component tests; generated layout
tests still capture the layout element, and their child fixture lacks the
explicit placeholder label. The proposed repair is prepared in the ignored
`.cache/harness/layout-page-contract/product.patch`; it is not applied or tested.

Focused formatting admission on `harbor-mbp-2` timed out with exhausted CPU
reserve. Its primary-Mac counterpart timed out with memory pressure. Neither
command reached the formatter. No failed test or red/green record was fabricated.
The failing-test command for checkpoint `14f914dbbc` also timed out before
admission on the primary Mac. It launched no test worker and produced no red
record. The product repair remains unapplied; the loop's red step stays pending.
Normal unit checks, generated-project browser qualification, fresh screenshots,
baseline review and the broader migration's verification remain pending.

No production deployment or merged-main delivery is claimed. Pre-existing
method-state loop metadata remains outside this change's commits.
