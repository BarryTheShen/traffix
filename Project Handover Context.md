# Traffix Project Handover Context

This document serves as a comprehensive record of the Traffix project status, architecture, and chat history as of January 21, 2026. Use this to maintain continuity in future sessions.

---

## 1. Project Overview
**Traffix** is a "0-player" traffic simulation game where players design traffic light algorithms to optimize vehicle flow. The game features realistic physics, procedural map generation, and a sophisticated scoring/penalty system.

### Key Game Mechanics
- **Endless Mode:** Traffic density increases over time.
- **Game Over Condition:** If a car is stuck at its entry point for > 20 seconds (1200 ticks), the game ends.
- **Collision System:** Cars can physically crash (overlap). Crashed cars block lanes for 10 seconds and incur a -1000 point penalty.
- **Programmable Lights:** Each intersection has a sequencer where players add/edit phases (NS Green, NS Yellow, All Red, etc.).
- **Rebel Drivers:** 0.5% of cars are "Rebels" that ignore lane discipline (e.g., turning from a straight-only lane).

---

## 2. File Architecture & Responsibilities

### `/src/core/`
- **Simulation.ts:** The heart of the game. Manages the main loop (60 TPS), car spawning, score, global game state (GameOver, SpawnRate), and handles the cleanup of wrecked/exited vehicles.
- **MapGenerator.ts:** Handles procedural generation using a randomized Kruskal's maze algorithm. Contains level templates (Tutorial, Classic, Level 1, Level 2). Ensures road connectivity and junction detection.
- **Pathfinding.ts:** A* implementation customized for road networks. Enforces lane discipline (Left lane turns left/straight, Right lane turns right/straight) and handles the "Rebel" rule-breaking override.
- **Intersection.ts:** Logic for a single intersection. Manages its own phases, timers, and applies states to its child `TrafficLight` entities.
- **TrafficLightController.ts:** A high-level controller that simply iterates and updates all active intersections.
- **types.ts:** Centralized TypeScript interfaces for the whole project (SimulationState, GridCell, etc.).

### `/src/entities/`
- **Car.ts:** Individual vehicle logic. Contains the "Driver AI" (following, braking distance math $v^2/2a$, and perception delays). Handles physics, collision timers, and the "Spawn-Stuck" detection logic.
- **TrafficLight.ts:** Data structure for an individual light signal (position, ID, current state).

### `/src/renderer/`
- **Renderer.ts:** PixiJS v8 implementation. Handles drawing the static grid, dynamic entities (cars, lights), and visual UI elements like **Countdown Timers** and **Lane Dots**. 
    - *Crucial:* Uses `beginPath()` to prevent Pixi v8 color bleeding.

### `/src/ui/`
- **UI.ts:** HTML/CSS overlay. Manages the control panel, start screen, and game-over screens. Synchronizes sliders (speed, spawn rate) with the simulation state.

---

## 3. Current Status & "Troubleshooting Mandate"

### Status
- **Visuals:** Clean, artifact-free grid. Distinct colors for Roads, Entry (Blue), and Exit (Grey). High-visibility 4x4 lane dots.
- **Physics:** Stable. Normal cars rarely crash unless a Rebel cuts them off. Predictive braking is functional.
- **Maps:** Random maps are connected and organic. Traffic lights spawn at all junctions.

### Known Problems / Potential Fixes
1.  **Reaction vs. Braking:** Finding the perfect balance between "human delay" and "safe stopping." Cars currently use a relative-velocity model to match speeds in line.
2.  **Red Light "Brick Wall":** Cars currently stop instantly if they touch a stop line while red. This is functional but can look "jerky" at high speeds.
3.  **T-Junction Lights:** While much improved, some complex random junctions might still miss a light direction if the road segment is very unusual.

### The Troubleshooting Mandate
**Instruction:** DO NOT guess at root causes. 
1.  Reproduce the error by running a simulation (or using a script like `troubleshoot.ts`).
2.  Observe the specific coordinate or tick where the error occurs.
3.  Verify the fix through simulation before concluding the task.

---

## 4. Session History Summary (Jan 21, 2026)

### Key Achievements:
- **Red Flashing Fix:** Resolved by implementing a strict coordinate check (within 0.5 units of spawn) so cars in the middle of the road never trigger spawn-stuck warnings.
- **Pixi v8 Repair:** Fixed a major bug where the whole screen would turn one color due to lack of `beginPath()`.
- **Procedural Generation:** Switched from "Snake" walkers to Kruskal's maze, resulting in better connectivity and realistic junction spacing.
- **Customization:** Added Debug sliders for Accel, Decel, Rebel%, and Crash Penalties.
- **Visual Timers:** Added real-time countdowns above crashed and stuck cars.

---

## 5. How to Continue
1.  Run `npm run dev` to start the simulation.
2.  Use the **"Color Rebels"** debug toggle to see the rule-breakers.
3.  Modify `MapGenerator.ts` to add more complex junction types (e.g., roundabouts).
4.  Monitor the browser console (`F12`) for "Spawn Stuck" logs if troubleshooting game-end conditions.
