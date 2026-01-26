# 🚦 Traffix

A real-time traffic simulation puzzle game where you control traffic lights to prevent gridlock and keep vehicles flowing smoothly.

![Version](https://img.shields.io/badge/version-0.2.1.1-blue)

## 🎮 How to Play

### Objective
Keep traffic moving! Vehicles spawn from entry points and must reach their exit destinations. Your job is to manage traffic lights to prevent collisions and keep the roads clear.

### Controls
- **Click on intersection** - Opens traffic light configuration panel
- **Click on car** - Track its path and view vehicle information
- **Pause button** - Pause/resume the simulation
- **Speed slider** - Adjust simulation speed

### Game Over Conditions
- A vehicle gets stuck at a spawn point for too long (blocking new vehicles)
- Too many collisions occur

### Scoring
- **+10 points** for each vehicle that successfully exits
- Avoid collisions and stuck vehicles to maximize your score!

## ✨ Features

### 🗺️ Procedural Map Generation
- Multiple complexity levels (1-5 intersections to 3x3 grids)
- Randomized layouts for unique gameplay each time
- Tutorial level for learning the basics

### 🚗 Realistic Vehicle AI
- **Smooth physics** - Acceleration, braking, and realistic stopping distances
- **Wave effect** - Cars start moving one after another like real traffic (12-tick reaction time)
- **Following distance** - Vehicles maintain safe gaps (0.5 car-lengths)
- **Collision detection** - Vehicles detect and react to traffic ahead

### 🚦 Traffic Light System
- **Configurable phases** - Set green/yellow/red durations per intersection
- **Directional controls** - Control North-South and East-West traffic separately
- **Visual indicators** - Clear light states with color-coded display

### 📊 Debug & Analytics
- Real-time vehicle tracking
- Path visualization for selected vehicles
- Queue monitoring at entry points
- Performance metrics and stuck detection

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm (or yarn)

### Installation

```bash
# Clone the repository
cd traffix

# Install dependencies
npm install

# Start development server
npm run dev
```

Open your browser to `http://localhost:5173` and start playing!

### Build for Production
```bash
npm run build
npm run preview
```

## 🎯 Tips & Strategies

1. **Watch the queues** - If cars are backing up at an entry point, adjust nearby lights
2. **Anticipate flow** - Look ahead to see where traffic is heading
3. **Balance phases** - Don't favor one direction too long or the other backs up
4. **Use the wave** - When lights turn green, cars start moving in a wave pattern - use this to your advantage

## 🛠️ Development

### Running Tests
```bash
# Run all tests
npx vitest run

# Run specific test file
npx vitest run src/v0.2.1.1_fixes.test.ts

# Run tests in watch mode
npx vitest
```

### Project Structure
```
traffix/src/
├── core/           # Simulation engine, map generation, pathfinding
├── entities/       # Vehicle AI, traffic lights
├── renderer/       # PixiJS rendering layer
├── ui/             # HTML controls and overlays
└── *.test.ts       # Test files
```

### Key Configuration (for modders)
- `Car.ts` - Vehicle physics (speed, acceleration, reaction time)
- `Simulation.ts` - Spawn rates, game timers, difficulty settings
- `MapGenerator.ts` - Level layouts and complexity scaling

## 📝 Changelog

### v0.2.1.1
- ✅ Fixed car click detection accuracy
- ✅ Restored wave effect - cars start one after another instead of all at once
- ✅ Reduced following distance to 0.5 car-lengths
- ✅ Improved benchmark stability (0 collisions for normal traffic)
- ✅ Updated documentation

### v0.2.1
- Fixed random map generation
- Fixed queue display
- Fixed warning banner timing
- Improved following distance physics

## 📄 License

MIT License - Feel free to use, modify, and distribute!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

For bug reports, please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information
