## MODIFIED Requirements

### Requirement: RTL reading order via recursive spatial partitioning

The system SHALL compute reading order for detected panels using a recursive spatial partitioning algorithm that supports right-to-left manga reading direction. At each recursion step the system SHALL choose the separating cut (horizontal or vertical) that minimizes how much it straddles any panel, where straddle is measured as the clipped fraction of that panel's own extent on the cut axis. A panel straddled by the chosen cut SHALL be assigned to the side holding the majority of its area. A region SHALL become a leaf only when it contains a single panel or is genuinely inseparable (no cut places at least one panel on each side without straddling some panel beyond the configured `maxStraddleRatio`).

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

#### Scenario: Genuinely inseparable region

- **WHEN** no horizontal or vertical cut can place at least one panel on each side without straddling some panel by more than `maxStraddleRatio`
- **THEN** the algorithm SHALL emit the region's panels in a deterministic geometric order (top-to-bottom, then right-to-left), guaranteeing termination
