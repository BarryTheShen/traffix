# Traffix: Traffic Simulation Engineering Report

This document details the engineering challenges, debugging sessions, and architectural solutions implemented to achieve a stable and realistic traffic simulation for the Traffix Hackathon project.

---

## 1. Problem: "Brick Wall" Red Lights & Jerky Physics
### Problem Description:
Initially, cars would come to an instantaneous stop upon hitting a red light or detecting an obstacle. This created a "jerky" visual effect and didn't allow for high-speed traffic flow as the stopping distance wasn't accounted for in the driver's intent.

### Implementation Solution:
We implemented a **Kinematic Predictive Braking Model**. Instead of simple distance checks, the vehicle now constantly calculates its required stopping distance based on its current velocity:
$$d = \frac{v^2}{2a} + \text{buffer}$$
- **Result:** Vehicles now maintain their maximum speed for as long as possible and only begin decelerating at the "last safe moment."
- **Turn Slowdown:** Integrated turn detection that looks ahead at the path curvature (dot product of upcoming segments) and reduces the vehicle's $v_{max}$ accordingly.

---

## 2. Problem: Intersection Gridlock & "Deadlock"
### Problem Description:
During paired green phases (e.g., North and South moving simultaneously), vehicles attempting to turn left would frequently collide with oncoming traffic or get stuck in the middle of the intersection, blocking all other phases.

### Implementation Solution:
1.  **4-Way Individual Round Robin:** Switched from paired phases to a strict individual direction system (North, then South, then East, then West).
    - **Timing:** 150 ticks Green, 30 ticks Yellow, and a critical 30-tick "All Red" phase to allow the junction to clear.
2.  **Intersection Yield Logic:** Even during a green light, vehicles now perform a "lookahead" into the intersection box. If they detect a vehicle already in the box that crosses their projected path, they will yield at the entry line.
3.  **"Don't Block the Box" (Clearance Check):** Vehicles will not enter an intersection unless there is at least 1.2 units of free space *past* the exit of the intersection.

---

## 3. Problem: The "Stuck in BRAKING" State Flip-Flop
### Problem Description:
Long-running simulations revealed a bug where vehicles would reach 0 velocity while in the `BRAKING` state but never transition to `STOPPED`. Because the logic required them to be `STOPPED` to trigger the sequential startup delay, they would remain immobile forever.

### Implementation Solution:
- **State Transition Repair:** Added a secondary check where any vehicle with $v < 0.01$ within a small distance of an obstacle is forced into the `STOPPED` state.
- **Sequential Startup wave:** Implemented a `perceptionDelay` (10-25 ticks) that triggers only when a `STOPPED` vehicle sees its path clear, creating a realistic sequential "wave" of movement in traffic jams.

---

## 4. Problem: Panic Lane Changing & Avoidance
### Problem Description:
Vehicles were too aggressive in "dodging" cars in other lanes or opposite directions, leading to unnatural swerving and "panic" lane changes.

### Implementation Solution:
- **Brake-First Philosophy:** Overhauled the Driver AI to prioritize braking over lane changing.
- **Lane Lock:** A vehicle must be stuck ($v \approx 0$) for at least 240 ticks (4 seconds) before it even considers a lane change.
- **Tight Lateral Detection:** Reduced the obstacle detection width to 0.4 units. This ensures vehicles only react to cars directly in their path and ignore traffic in adjacent or opposite lanes.

---

## 5. Problem: Map Capacity Collapse
### Problem Description:
As the simulation progressed, the spawn rate would grow infinitely, eventually outstripping the throughput of the intersections, leading to a guaranteed "Map Full" Game Over.

### Implementation Solution:
- **Capped Growth:** The dynamic spawn rate now caps at 10.0 vehicles/second.
- **Cleanup Optimization:** Stuck vehicles are now automatically "towed" (removed) after 20 seconds of immobility, and crashed vehicles are cleared after 5 seconds to prevent permanent blockages.
- **Reset Reliability:** Fixed a bug where the `totalCrashes` counter wasn't resetting on game restart, causing immediate game overs on subsequent runs.

---

## 6. Technical Architecture Summary
- **Main Loop:** 60 TPS (Ticks Per Second) decoupled from rendering.
- **Pathfinding:** A* with lane-discipline constraints and "Rebel" override.
- **Waypoint System:** Uses vector projection (dot product) to determine waypoint completion, allowing for smooth, sub-pixel accurate movement without "teleporting" or circular paths.
- **Recovery:** Randomized sub-pixel nudges for vehicles stuck > 3 seconds to resolve mathematical edge cases.
