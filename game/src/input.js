// input.js — keyboard and mouse state for LEONIDA PROTOCOL.
// Tracks held keys, one-frame "pressed" edges, and mouse position/clicks so the
// rest of the game can poll input without touching DOM events itself.

export function createInput(canvas) {
  const held = new Set();
  const pressedEdges = new Set();
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };

  const code = (e) => e.code;

  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (!held.has(code(e))) pressedEdges.add(code(e));
    held.add(code(e));
  });
  window.addEventListener("keyup", (e) => held.delete(code(e)));
  window.addEventListener("blur", () => held.clear());

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener("mousedown", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.clicked = true;
    mouse.clickX = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.clickY = ((e.clientY - r.top) / r.height) * canvas.height;
  });

  return {
    mouse,
    down(...codes) {
      return codes.some((c) => held.has(c));
    },
    pressed(...codes) {
      return codes.some((c) => pressedEdges.has(c));
    },
    // Called once at the end of every frame: edges and clicks last one frame.
    endFrame() {
      pressedEdges.clear();
      mouse.clicked = false;
    },
  };
}
