// Координаты: центр (0,0), X: лево=-2..право=2, Y: верх=2..низ=-2
const SIZE = 5;
const LAYERS = 10;
const HALF = Math.floor(SIZE / 2); // 2

// layers[layer][row][col] = { color, symbol } | null
const layers = Array.from({ length: LAYERS }, () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
);

let currentLayer = 0;

function colToX(col) { return col - HALF; }       // 0→-2, 2→0, 4→2
function rowToY(row) { return HALF - row; }        // 0→2, 2→0, 4→-2

function buildGrid() {
  const container = document.getElementById('grid-container');
  container.innerHTML = '';

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;

      const coord = document.createElement('span');
      coord.className = 'coord';
      coord.textContent = `${colToX(col)},${rowToY(row)}`;
      cell.appendChild(coord);

      cell.addEventListener('click', () => onCellClick(row, col, cell));
      container.appendChild(cell);
    }
  }
}

function onCellClick(row, col, cell) {
  const data = layers[currentLayer][row][col];
  if (data) {
    // второй клик — очистить
    layers[currentLayer][row][col] = null;
  } else {
    const color = document.getElementById('colorPicker').value;
    const symbol = document.getElementById('symbolInput').value || '■';
    layers[currentLayer][row][col] = { color, symbol };
  }
  renderGrid();
  renderDots();
}

function renderGrid() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach(cell => {
    const row = +cell.dataset.row;
    const col = +cell.dataset.col;
    const data = layers[currentLayer][row][col];

    // remove old symbol span if any
    const old = cell.querySelector('.sym');
    if (old) old.remove();

    if (data) {
      cell.style.background = data.color + '55'; // полупрозрачный фон
      cell.style.borderColor = data.color;
      cell.classList.add('filled');
      const sym = document.createElement('span');
      sym.className = 'sym';
      sym.textContent = data.symbol;
      sym.style.color = data.color;
      sym.style.fontSize = '22px';
      cell.insertBefore(sym, cell.firstChild);
    } else {
      cell.style.background = '';
      cell.style.borderColor = '';
      cell.classList.remove('filled');
    }
  });
}

function buildDots() {
  const container = document.getElementById('layer-dots');
  container.innerHTML = '';
  for (let i = 0; i < LAYERS; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.title = `Слой ${i + 1}`;
    dot.addEventListener('click', () => { currentLayer = i; updateLayerUI(); });
    container.appendChild(dot);
  }
}

function renderDots() {
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentLayer);
    const hasData = layers[i].some(row => row.some(c => c !== null));
    dot.classList.toggle('has-data', hasData);
  });
}

function updateLayerUI() {
  document.getElementById('layer-label').textContent = `Слой ${currentLayer + 1}`;
  renderGrid();
  renderDots();
}

function changeLayer(dir) {
  currentLayer = (currentLayer + dir + LAYERS) % LAYERS;
  updateLayerUI();
}

function clearLayer() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      layers[currentLayer][r][c] = null;
  renderGrid();
  renderDots();
}

function clearAll() {
  for (let l = 0; l < LAYERS; l++)
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        layers[l][r][c] = null;
  renderGrid();
  renderDots();
}

// Init
buildGrid();
buildDots();
updateLayerUI();
