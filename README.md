# Traffix

Traffix is a "0-player" traffic simulation game where the goal is to optimize traffic flow through procedural road networks. Players (or developers) design and tune traffic light algorithms and car behaviors to prevent gridlock and maximize the number of vehicles that successfully reach their destinations.

## Game Rules & Mechanics

### Core Gameplay
- **Endless Mode:** Traffic density increases as time passes.
- **Goal:** Manage intersections to keep traffic moving.
- **Scoring:**
  - `+10` points for every car that successfully exits the map.
  - `-10` points if a car is removed due to being stuck for too long.
  - `-1000` points for every car collision (crash).

### Game Over Conditions
- **Spawn Blockage:** If a car is unable to move from its entry point for more than 20 seconds (1200 ticks), the game ends in gridlock.

### Vehicle AI & Decision Making
- **Predictive Braking:** Cars use $v^2/2a$ math to calculate safe stopping distances based on relative velocity.
- **Overtaking:** Cars will attempt to change lanes if blocked by a slow or stopped vehicle.
- **Rerouting & Deadlock Recovery:**
  - If a car is stuck for > 10 seconds, it will recalculate its path.
  - In extreme deadlock scenarios, stuck cars can become "Temporary Rebels," allowing them to ignore lane rules to bypass obstacles and clear the way.
- **Rebel Drivers:** A small percentage (default 0.5%) of drivers ignore lane discipline from spawn.

### Procedural Map Generation
- **Kruskal's Algorithm:** Generates connected, organic road networks.
- **Intersection Detection:** Automatically places 4x4 intersections at road junctions.
- **Full Coverage:** Ensures road segments overlap correctly to prevent "missing corners" or gaps in the drivable area.

## Project Structure

- `traffix/src/core/`:
  - `Simulation.ts`: The main engine handling the game loop, spawning, and state management.
  - `MapGenerator.ts`: Procedural map generation logic.
  - `Pathfinding.ts`: A* implementation for vehicle routing.
  - `Intersection.ts`: Logic for individual intersection timing and phases.
- `traffix/src/entities/`:
  - `Car.ts`: Vehicle AI, physics (acceleration, braking), and collision detection.
  - `TrafficLight.ts`: Signal state management.
- `traffix/src/renderer/`:
  - `Renderer.ts`: PixiJS-based rendering engine.
- `traffix/src/ui/`:
  - `UI.ts`: HTML-based user interface and controls.

## Development & Troubleshooting

### Troubleshooting Mandate
Before fixing any bug, it must be reproduced. Use `npm run dev` or troubleshooting scripts to observe the issue at specific coordinates or ticks.

### Known Challenges
- **Rebel Deadlocks:** Rebel drivers can sometimes cause head-on standoffs.
- **Overtaking:** Improving car AI to switch lanes when blocked by slow or crashed vehicles.
- **Map Connectivity:** Ensuring all procedural junctions are correctly formed with proper corners.

---
*Last updated: January 22, 2026*