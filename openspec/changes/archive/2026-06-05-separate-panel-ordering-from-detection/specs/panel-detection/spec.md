## ADDED Requirements

### Requirement: Ordering is a separate stage from detection

Reading-order assignment SHALL be a distinct stage that consumes a set of panel boxes (`RawPanel[]`) and produces ordered `Panel[]` plus a reading tree. Detection and ordering SHALL be composable such that ordering can run over already-stored panel geometry without re-running detection.

#### Scenario: Detection followed by ordering

- **WHEN** detection produces panels for a page
- **THEN** the ordering stage SHALL be applied to those panels to produce the ordered `Panel[]` and reading tree

#### Scenario: Ordering runs independently of detection

- **WHEN** ordering is invoked over panel geometry that was stored by a prior detection run
- **THEN** ordered output SHALL be produced without invoking the detection model

#### Scenario: Ordering is a pure function of its inputs

- **WHEN** the ordering stage is applied to the same panels with the same configuration
- **THEN** it SHALL return the same ordered `Panel[]` and reading tree every time, independent of detection, the database, or the filesystem

### Requirement: Reading-order behaviour is pinned by tests

The reading-order algorithm's observable behaviour SHALL be covered by a test suite consisting of labelled correctness fixtures (each asserting the expected reading order for a described layout) and a golden snapshot of current output. Any change to the ordering algorithm SHALL be reflected as a deliberate update to the affected labelled fixture with a stated justification.

#### Scenario: Labelled fixture asserts expected order

- **WHEN** the ordering stage is run against a labelled fixture layout
- **THEN** the produced panel id order SHALL equal the fixture's documented `expected` order

#### Scenario: Structural invariants hold for any layout

- **WHEN** the ordering stage is run against any set of input panels
- **THEN** the output SHALL contain exactly the input panels with each id appearing once, `readingOrder` values forming a contiguous `1..N`, and the reading tree referencing exactly the returned panel ids

#### Scenario: Algorithm change is a reviewed snapshot change

- **WHEN** an ordering-algorithm fix changes the output for some layout
- **THEN** the golden snapshot diff SHALL be reviewed and the affected labelled fixture's `expected` updated with a justification, so unintended ripple to other layouts is caught
