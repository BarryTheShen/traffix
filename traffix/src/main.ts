import './style.css'
import { Simulation } from './core/Simulation'
import { Renderer } from './renderer/Renderer'
import { UI } from './ui/UI'

const appContainer = document.getElementById('app')!;

async function init() {
  const simulation = new Simulation(80, 40);
  const renderer = new Renderer(appContainer);
  const ui = new UI(document.body, simulation);

  await renderer.init();
  ui.init();

  simulation.logger = (msg) => ui.log(msg);

  simulation.onTick = (state) => {
    renderer.render(state);
    ui.update(state);
  };

  // Selection Logic
  const canvas = appContainer.querySelector('canvas');
  canvas?.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // First check for vehicle selection
    const vehicleId = renderer.getVehicleAt(x, y, simulation.getState());
    if (vehicleId) {
      simulation.selectedVehicleId = vehicleId;
      (window as any).renderer.debugMode = true;
      ui.log(`Selected: ${vehicleId}`);
      return;
    }

    // Check for intersection click
    const intersectionId = renderer.getIntersectionAt(x, y);
    if (intersectionId) {
      // Show popup at click position
      ui.showIntersectionPopup(intersectionId, e.clientX, e.clientY);
      ui.log(`Clicked intersection: ${intersectionId}`);
    }
  });

  simulation.start();
  (window as any).simulation = simulation;
  (window as any).renderer = renderer;
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<div style="color:red; padding:20px; font-family:monospace;">
        <h1>Startup Error</h1>
        <pre>${err.message}\n${err.stack}</pre>
    </div>`;
});
