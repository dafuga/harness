# Testing plugin resource navigation

The new testing-plugin filter at 034171aafe removed direct testing resources from
Code tabs. Code's active state still depended entirely on a selected child tab.
Opening a testing resource therefore removed the Code row and selected no parent.

The standard navbar matrix checked Styles, Modules/Plugins and Permissions screens,
but omitted a module-resources screen without its own direct tab. The manual
Playwright plugin walkthrough exposed that state before landing.

The repair selects Plugins when a module-resource page has no direct Code tab.
The existing matrix now requires Code and exactly one Plugins tab for that state,
with the same branch and commit retained. Direct resource tabs retain precedence.
This assertion remains in the normal Reports component suite.

The committed failing matrix is replayed in Harness's isolated regression snapshot;
the repaired source must pass that unchanged matrix. The original failing revision
also provides the isolated guard replay after repair. No live server is rolled back.
