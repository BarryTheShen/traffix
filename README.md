Live demo: https://traffix.mrking.io/

# Traffix

Traffix is a "0-player" traffic simulation focused on emergent traffic behavior in procedurally generated road networks. The primary uses are:

- Research and tuning of traffic-signal algorithms and vehicle AI.
- Reproduction and debugging of traffic edge-cases (gridlock, sliding, collision chains).

## Installation

Prerequisites:
- Node.js 18+ (LTS recommended)
- npm (or yarn)

Quick start:

```bash
# install dependencies
cd traffix
npm install

# run development server (hot reload)
npm run dev

# run unit & integration tests
npx vitest run
```

Optional:
- Build the renderer for production: `npm run build`
- Run a single test file: `npx vitest run src/reproduce_sliding_queue.test.ts`

## Game Rules & Mechanics (Developer-focused)

These rules and parameter notes are written to help contributors reproduce behavior and tune the simulator.

- Coordinate system: grid cells + floating positions. Y increases southwards.
- Tick rate: simulation advances in discrete ticks. Many tests and constants assume 60 ticks ≈ 1 simulated second.

- Vehicles
  - Visual gap target: 0.6 units (≈1.2 center-to-center).
  - Braking: vehicles use kinematic stopping-distance math (v^2 / (2*a)) to decide when to brake.
  - Reaction/perception: vehicles have a `perceptionDelay` enabling staged starts and reaction latency.
  - Spawn stuck detection: `spawnStuckTimer` increments when a vehicle's speed is near-zero and it remains close to its spawn point; long-lived values indicate blocked entries.
  - Stuck cleanup: vehicles with high `stuckTimer` get removed after `stuckCleanupTimeout` ticks.

- Traffic lights & lanes
  - Lights are associated with `roadId` and intersection naming follows the `int{idx}_{dir}{lane}` scheme.
  - Light detection is lane-aware: the vehicle computes heading and uses an ahead/cross corridor test to detect only the light for its lane.
  - Vehicles will brake for red lights using dynamic safety buffers; hard stops are triggered when the stopping distance is passed.

- Spawning and queue management
  - Spawn points are `entry` cells on the grid. If blocked, the sim keeps `laneQueues` to track deferred spawns per lane.
  - An adaptive spawn rate reduces new spawns when queues or blocked spawn points are detected to prevent runaway gridlock.

- Scoring & game over
  - Score: +10 points per exited vehicle; penalties for crashes/removals.
  - Game over occurs when an entry has a vehicle stuck at spawn longer than `gameOverTimeout` (default ≈ 1200 ticks).
  - The simulation includes cleanup heuristics and adaptive spawn throttling to reduce the chance of permanent blockages.

## Project Structure

- `traffix/src/core/`
  - `Simulation.ts` — engine, spawn logic, queue processing, and game state.
  - `MapGenerator.ts` — procedural level generator (roads, entries, exits, intersections).
  - `Pathfinding.ts` — pathfinder used by vehicles (A* variant).
  - `Intersection.ts` — intersection phase handling.

- `traffix/src/entities/`
  - `Car.ts` — vehicle AI, braking, collision detection, and movement integration.
  - `TrafficLight.ts` — per-intersection light objects and phases.

- `traffix/src/renderer/` — rendering layer (PixiJS) used by the demo UI.
- `traffix/src/ui/` — simple HTML controls for experiments.

## Debugging & Useful Commands

- Reproduce targeted issues with the tests:
  - Light sliding + queue: `npx vitest run src/reproduce_sliding_queue.test.ts`
  - Gap verification: `npx vitest run src/verify_gap.test.ts`
  - Headless stress test: `npx vitest run src/stress_test.test.ts`

- Typical debugging workflow:
 1. Reproduce the issue with a minimal test case in `src/*.test.ts`.
 2. Add temporary logs in `traffix/src/entities/Car.ts` or `traffix/src/core/Simulation.ts` to trace per-tick state.
 3. Tune corridor widths, safety buffers, spawn throttling, or cleanup timeouts and re-run tests.

## Key tuning knobs (where to look in code)

- `Simulation.baseSpawnRate`, `Simulation.spawnRate` — baseline spawn multipliers.
- `Simulation.gameOverTimeout` — ticks until spawn blockage triggers a game over (default ~1200).
- `Simulation.stuckCleanupTimeout` — ticks after which vehicles are garbage-collected when stuck.
- `Car.perceptionDelay`, `Car.acceleration`, `Car.deceleration`, `Car.maxVelocity` — vehicle dynamics.
- Light corridor and lane detection thresholds are found in `Car.getNearestLightInCorridor()` and lane/cross checks in `Car.getLeadVehicleVector()`.

## Contributing

- Please open an issue for any behavior you'd like to change or an edge-case you reproduced.
- Provide a small test reproducer under `traffix/src` when submitting a patch (preferably a failing test first, then a fix).

If you want, I can export a separate `docs/parameters.md` listing exact default values and the variable names for quick reference.

---
*Last updated: January 23, 2026*