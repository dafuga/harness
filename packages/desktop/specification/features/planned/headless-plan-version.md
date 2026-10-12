# Feature: Headless Plan Version

## Overview

Function, service, and config Plan comments identify their exact saved version after reload.

## Acceptance Criteria

- A completed headless Plan binds the saved notes hash and version without an image.
- A later version preserves earlier comment links and the existing message bytes.
- Visual comments retain image references; invalid image selection cannot become a notes reference.
- Legacy comments without references retain an explicit missing version.

## Future Enhancements

- No historical message rewriting.
