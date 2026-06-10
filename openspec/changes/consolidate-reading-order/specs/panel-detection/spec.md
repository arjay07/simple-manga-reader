# panel-detection Delta

## REMOVED Requirements

### Requirement: Reading tree output

**Reason**: The `readingTree` structure has no consumer anywhere in the application — the Reader's smart panel zoom navigates the flat ordered `panels` array, `DetectionCanvas` draws only panels, and the admin preview passes `readingTree: null`. Building, persisting, recomputing on every read, and serializing it into every response is pure waste, and the cosmetic `chainTree` fabrication exists only to satisfy this requirement.

**Migration**: None required — no consumer exists. Should a future feature need the partition hierarchy, tree assembly can be reintroduced in the ordering stage; because reading order is derived from stored geometry at read time, it would immediately apply to all stored volumes with no data migration.

## MODIFIED Requirements

### Requirement: RTL reading order via recursive spatial partitioning

The system SHALL compute reading order for detected panels using a recursive spatial partitioning algorithm that supports right-to-left manga reading direction. At each recursion step the system SHALL choose the separating cut (horizontal or vertical) that minimizes how much it straddles any panel, where straddle is measured as the clipped fraction of that panel's own extent on the cut axis. A panel straddled by the chosen cut SHALL be assigned to the side holding the majority of its area. A clean vertical cut that isolates a single effectively full-height panel on the right SHALL take precedence over a horizontal cut (the right-hand column is read first, RTL). A region SHALL become a leaf only when it contains a single panel or is genuinely inseparable. The computed reading order SHALL be a pure function of panel geometry and configuration alone — independent of the order in which the input panels are supplied.

#### Scenario: Regular grid with simple rows

- **WHEN** panels form clear horizontal rows
- **THEN** rows SHALL be processed top-to-bottom, and panels within each row SHALL be ordered right-to-left

#### Scenario: Panel spanning multiple sub-rows

- **WHEN** a tall panel occupies the full height alongside smaller stacked panels
- **THEN** the algorithm SHALL select a vertical cut separating the tall panel from the sub-rows, process the right side first (RTL), recurse into the sub-rows, then process the left side

#### Scenario: Staggered / offset rows

- **WHEN** panels almost form rows but a panel is offset so that it straddles where the row-separating gutter would fall, and the straddle is at most `maxStraddleRatio` of that panel's height
- **THEN** the algorithm SHALL still take the horizontal cut, assign the straddling panel to the side holding the majority of its area, and SHALL NOT fall back to an undirected positional sort

#### Scenario: Diagonal staircase

- **WHEN** panels descend diagonally, each overlapping the next in both axes, with no perfectly clean horizontal or vertical gutter
- **THEN** the algorithm SHALL select the cut with the least relative straddle, peeling panels in reading order (the panel that lies mostly earlier in reading order on the chosen side first), and recurse — producing top-to-bottom, right-to-left order along the staircase

#### Scenario: Cut selection by minimum straddle

- **WHEN** more than one separating cut exists for a region
- **THEN** the algorithm SHALL prefer the cut with the smallest relative straddle, breaking ties in favor of a horizontal cut (rows before columns), then the wider gutter, then the geometrically earlier cut position — never by input order

#### Scenario: Slanted top row is kept together

- **WHEN** the top tier is two (or more) panels that overlap in their vertical extent but are clearly separated left-to-right (a slanted/diagonally-cut row)
- **THEN** the algorithm SHALL treat them as a single row read right-to-left, and SHALL NOT split the row by isolating one panel above the others with a horizontal cut

#### Scenario: Tall right-hand column reads before the strip to its left

- **WHEN** a tall, effectively full-height panel occupies the right-hand side of a region while a shorter strip and stacked rows occupy the left, separated from the column by a clean vertical gutter
- **THEN** the right-hand column SHALL be read first (RTL precedence), before the top strip and the rows to its left

#### Scenario: Genuinely inseparable region

- **WHEN** no horizontal or vertical cut can place at least one panel on each side without straddling some panel by more than `maxStraddleRatio`
- **THEN** the algorithm SHALL cluster the overlapping panels into rows via the transitive closure of the pairwise row relation (two panels are a row when they overlap in Y for most of the shorter panel's height and the majority of the right panel's width extends past the left panel's right edge), order the clusters top-to-bottom by mean vertical center, and order panels within each cluster right-to-left — guaranteeing termination and an order independent of input sequence

#### Scenario: Reading order is permutation-invariant

- **WHEN** the same set of panel boxes is supplied to the ordering stage in any input order
- **THEN** the resulting geometric reading sequence SHALL be identical for every permutation

### Requirement: Ordering is a separate stage from detection

Reading-order assignment SHALL be a distinct stage that consumes a set of panel boxes (`RawPanel[]`) and produces ordered `Panel[]`. Detection and ordering SHALL be composable such that ordering can run over already-stored panel geometry without re-running detection.

#### Scenario: Detection followed by ordering

- **WHEN** detection produces panels for a page
- **THEN** the ordering stage SHALL be applied to those panels to produce the ordered `Panel[]`

#### Scenario: Ordering runs independently of detection

- **WHEN** ordering is invoked over panel geometry that was stored by a prior detection run
- **THEN** ordered output SHALL be produced without invoking the detection model

#### Scenario: Ordering is a pure function of its inputs

- **WHEN** the ordering stage is applied to the same panels with the same configuration
- **THEN** it SHALL return the same ordered `Panel[]` every time, independent of detection, the database, the filesystem, and the input ordering of the panels

### Requirement: Reading-order behaviour is pinned by tests

The reading-order algorithm's observable behaviour SHALL be covered by a test suite consisting of labelled correctness fixtures (each asserting the expected reading order for a described layout), a golden snapshot of current output, and a real-page regression suite that pins confirmed correct orders from actual library pages. Any change to the ordering algorithm SHALL be reflected as a deliberate update to the affected fixture with a stated justification.

#### Scenario: Labelled fixture asserts expected order

- **WHEN** the ordering stage is run against a labelled fixture layout
- **THEN** the produced panel id order SHALL equal the fixture's documented `expected` order

#### Scenario: Real-page regression fixture asserts a confirmed order

- **WHEN** the ordering stage is run against a real-page regression fixture whose correct order was human-confirmed
- **THEN** the produced panel id order SHALL equal the fixture's confirmed `expectedOrder`, and a fixture marked as a known failure SHALL flip to a passing assertion once a fix lands

#### Scenario: Structural invariants hold for any layout

- **WHEN** the ordering stage is run against any set of input panels
- **THEN** the output SHALL contain exactly the input panels with each id appearing once, and `readingOrder` values forming a contiguous `1..N`

#### Scenario: Permutation invariance holds for any layout

- **WHEN** the ordering stage is run against deterministic permutations (including reversal and seeded shuffles) of any generated layout, including heavily-overlapping layouts that exercise the inseparable fallback
- **THEN** the geometric reading sequence (panels keyed by geometry, not by assigned id) SHALL be identical across all permutations

#### Scenario: Algorithm fix updates fixtures deliberately

- **WHEN** an ordering-algorithm fix changes the output for some layout
- **THEN** the affected labelled/golden/regression fixture SHALL be updated deliberately with a stated justification, and unaffected fixtures SHALL remain unchanged
