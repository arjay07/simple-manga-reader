## MODIFIED Requirements

### Requirement: RTL reading order via recursive spatial partitioning

The system SHALL compute reading order for detected panels using a recursive spatial partitioning algorithm that supports right-to-left manga reading direction. At each recursion step the system SHALL choose the separating cut (horizontal or vertical) that minimizes how much it straddles any panel, where straddle is measured as the clipped fraction of that panel's own extent on the cut axis. A panel straddled by the chosen cut SHALL be assigned to the side holding the majority of its area. A clean vertical cut that isolates a single effectively full-height panel on the right SHALL take precedence over a horizontal cut (the right-hand column is read first, RTL). A region SHALL become a leaf only when it contains a single panel or is genuinely inseparable.

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
- **THEN** the algorithm SHALL prefer the cut with the smallest relative straddle, breaking ties in favor of a horizontal cut (rows before columns) and then the wider gutter

#### Scenario: Slanted top row is kept together

- **WHEN** the top tier is two (or more) panels that overlap in their vertical extent but are clearly separated left-to-right (a slanted/diagonally-cut row)
- **THEN** the algorithm SHALL treat them as a single row read right-to-left, and SHALL NOT split the row by isolating one panel above the others with a horizontal cut

#### Scenario: Tall right-hand column reads before the strip to its left

- **WHEN** a tall, effectively full-height panel occupies the right-hand side of a region while a shorter strip and stacked rows occupy the left, separated from the column by a clean vertical gutter
- **THEN** the right-hand column SHALL be read first (RTL precedence), before the top strip and the rows to its left

#### Scenario: Genuinely inseparable region

- **WHEN** no horizontal or vertical cut can place at least one panel on each side without straddling some panel by more than `maxStraddleRatio`
- **THEN** the algorithm SHALL order the overlapping cluster deterministically by a per-pair rule keyed on vertical overlap — two panels are a row (right-to-left) when they overlap in Y for most of the shorter panel's height and the majority of the right panel's width extends past the left panel's right edge; otherwise they are stacked (the higher reads first) — guaranteeing termination

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
- **THEN** the output SHALL contain exactly the input panels with each id appearing once, `readingOrder` values forming a contiguous `1..N`, and the reading tree referencing exactly the returned panel ids

#### Scenario: Algorithm fix updates fixtures deliberately

- **WHEN** an ordering-algorithm fix changes the output for some layout
- **THEN** the affected labelled/golden/regression fixture SHALL be updated deliberately with a stated justification, and unaffected fixtures SHALL remain unchanged
