## Summary: Traffix

**Game Name:** Traffix

**Platform:** Web (JavaScript/TypeScript + Canvas or Phaser/PixiJS)

**Art Style:** Pixel art

**Development:** Claude Code

---

### Session History & Problem Solving

#### Initial State
- Cars spawned slowly.
- Traffic light system was hardcoded and round-robin.
- Visual artifacts (random grey/blue boxes) appeared on roads.

#### session Jan 21, 2026 (Fixes & Features)
- **Problem:** Traffic jams were too punishing and cars were removed too quickly.
  - **Solution:** Implemented Collision Detection. Cars now physically "crash" (Purple) and stay for 1800 ticks before removal. Penalty increased to -1000.
- **Problem:** "Spawn Stuck" caused random game ends without warning.
  - **Solution:** Added a flashing warning banner and forced speed slowdown to 1.0x when a car is blocked at its entry point.
- **Problem:** Visual artifacts in the middle of roads.
  - **Solution:** Rewrote `MapGenerator.finalizeMap` to strictly assign 'entry' and 'exit' types only to map boundaries (x=0, y=0, etc.).
- **Problem:** Random Level generation was just a grid.
  - **Solution:** Implemented a "Snake" algorithm for organic, winding road networks with dynamic intersection detection.
- **Problem:** Cars were too perfectly law-abiding.
  - **Solution:** Added 0.5% chance for "Rebel" cars that ignore lane discipline (implemented via pathfinding override).
- **Problem:** UI/UX issues with reset and indicators.
  - **Solution:** Standardized Legend colors. Refined selection logic. Fixed reset to clear all growth accumulators and timers while preserving light rules (optionally).

#### visual Indicators & Legend
- **Moving (Yellow):** Car is travelling normally.
- **Stuck (Orange):** Car has been stopped for > 1200 ticks (20s). Warning of potential gridlock.
- **Blocked at Entry (Flashing Red):** Car is stopped at its spawn point for > 300 ticks.
- **Crashed (Purple with X):** Cars have physically collided. Blocks traffic for 1800 ticks (30s).
- **Selected (Blue):** The car currently being tracked.

#### Advanced Mechanics
- **Car Capabilities:** Configurable Acceleration and Deceleration. Higher values allow cars to stop and start faster, reducing the chance of accidents but requiring better timing.
- **Rebel Drivers:** Adjustable chance (default 0.5%) for cars to ignore lane discipline.
- **Improved Randomization:** Uses a Randomized Kruskal's spanning tree to create connected, organic road networks. Intersections are only placed at actual junctions (T-junctions, crosses, or corners).
- **Subtle Markers:** Lane direction dots are now much smaller and transparent to avoid confusion with Entry/Exit cell markings.

---

### Troubleshooting Mandate
**IMPORTANT:** Every bug fix or feature implementation must be preceded by a reproduction step. The developer must simulate the environment, observe the error, and verify the fix through simulation before delivery. Guessing at root causes is strictly prohibited.

---

### Session Logs & Chat History Summary

**Session 1:**
- Initial setup. Basic car movement and map.
- Implemented round-robin traffic lights.
- Discovered visual artifacts (grey pixels).

**Session 2:**
- Focused on "Endless mode" mechanics.
- Implemented Game Over on blocked spawn.
- Implemented Collision system (-1000 penalty).
- Implemented "Rebel" car behavior (0.5% rule breaking).
- Organic map generation ("Snake").
- Fixed "grey pixels" by edge-restricting entry/exits.
- Added UI warning banner for gridlock.

**Session 3:**
- **Visual Clarity:** Shrunk lane dots to prevent confusion with Entry/Exit blocks.
- **Physics Rework:** Replaced "Instant Physics" cheat with realistic "Car Capability" sliders (Accel/Decel).
- **Robust Random Levels:** Switched to Kruskal's algorithm for guaranteed road connectivity and clean junction detection.
- **Bug Fixes:** Resolved the "Middle of the road flashing red" bug by strictly verifying starting coordinates for spawn warnings. Increased car lookahead for smoother traffic flow.

---

### Key Design Decisions

#### Visuals
- **Lane Markers:** "Small dots" in lane centers (Blue/Red/Yellow/Purple). Yellow center lines separate opposing traffic.
- **Traffic Lights:** Dark housing with glowing signal circles.
- **Indicators:**
    - **Spawn Stuck:** Flashing Red/Yellow car + Top Warning Banner. Triggers after 300 ticks at entry.
    - **Crash:** Purple car with 'X' marking. Triggers on overlap (< 0.7 units). Remains for 1800 ticks.
    - **Stuck:** Orange car. Triggers after 600 ticks of low velocity (not at entry).
- **UI:** 
    - Real-time **Spawn Rate** display.
    - Legend explaining car states.
    - Level Selection Screen.

#### Simulation Mechanics
- **Spawn Logic:** 
    - Accumulator-based spawning.
    - **Base Rate:** 2.0 cars/sec.
    - **Growth:** +1.0 car/sec every 120 ticks (Rapid challenge).
- **Physics:**
    - Realistic braking ($v^2/2d$).
    - **Collision:** Physical overlap triggers crash. Heavy penalty (-1000).
- **Behavior:**
    - 0.5% chance to ignore lane discipline.
- **Map Generation:**
    - **Random Level:** Organic winding roads with detected intersections.
    - **Cleanup:** Only at map boundaries.

---

### Scoring
- **Success:** +10 points per car exited.
- **Stuck Removal:** -10 points.
- **Crash Penalty:** -1000 points.

**Note to Developer:** Rigorously maintain this outline. Document every session's key problems and solutions.