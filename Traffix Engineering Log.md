# Traffix Engineering Log - Traffic Simulation Overhaul

## Objective
Implement a high-density traffic simulation with:
1.  **0.5 car-sized gaps** (~0.3 units center-to-center gap, 0.9 units center-to-center total).
2.  **Zero "Ghost" crashes** (no phasing through wrecks or stopped cars).
3.  **Indefinite difficulty scaling** (uncapped spawn rate growth).
4.  **Robust deadlock recovery** (Safety Tow mechanism).

---

## Attempts & Results

### 1. Waypoint-Based Detection
- **Approach:** Cars only checked the car immediately at their next path waypoint.
- **Problem:** Frequent "Ghosting." Followers missed lead cars stopped between waypoints.

### 2. Radial Sweep along Path
- **Approach:** Projected a series of circles along the path segments.
- **Problem:** Cars would stop way too early (~6 units) or detect cars on perpendicular roads.

### 3. Euclidean Search Corridor (FAILED)
- **Approach:** Filtered for vehicles within a forward "rectangle" using Dot Product (dot > 0.1).
- **The "Overlap Acceleration" Discovery:** Tests revealed that once the follower's center passed the lead car's center, the `dot` product became negative. The follower instantly "lost" the lead car, perceived a clear path, and accelerated at maximum speed. This caused vehicles to phase through each other in discrete ticks.

### 4. Geometric Kinematic Braking ($v = \sqrt{2ad}$)
- **Approach:** Calculated the "Maximum Safe Velocity" every tick based on continuous-time physics.
- **The "Discrete Step" Failure:** At 60Hz, $v = \sqrt{2ad}$ is too optimistic. The actual discrete stopping distance is $D = v^2/2a + v/2$.

---

## Current Status: CRITICAL FAILURE
- **Root Cause:** Detection logic flickers during overlap, causing bursts of speed inside the collision radius.
- **Root Cause:** Movement loop was updating position *before* finalizing the "blocked" state in some iterations.

---

## Next Steps Plan (BREAKING THE LOOP - THE "SAFETY BUBBLE" STRATEGY)
1.  **Direction-Agnostic Proximity:** Modify `Lead Car Detection` to ignore the `dot > 0` check if `dist < 1.5` units. If they are that close, they are *always* an obstacle.
2.  **Discrete Stopping Formula:** Use $v_{safe} = (-a + \sqrt{a^2 + 8aD}) / 2$ to account for 60Hz tick steps.
3.  **Predictive Movement Guard:** In the sub-pixel loop, calculate `dist` to other cars *at the new candidate position* and strictly reject the move if `dist < 0.9`.
4.  **Atomic Position Update:** Ensure `this.position` is only updated after a step is confirmed clear.
5.  **Enhanced Debug Test:** Update `verify_gap.test.ts` to log `safeV` and `limitDist` per tick.
6.  **Hotkeys:** [DONE] Space for pause/resume.
