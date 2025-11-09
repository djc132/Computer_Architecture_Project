// Tab switching + full default content initialization
document.addEventListener("DOMContentLoaded", () => {
  // Helpers
  const toHex32 = (v) =>
    "0x" + (v >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const toHex8 = (v) =>
    "0x" + (v & 0xff).toString(16).padStart(2, "0").toUpperCase();

  // Cache DOM
  const tabButtons = document.querySelectorAll(".tab");
  const panes = {
    regs: document.getElementById("pane-regs"),
    mem: document.getElementById("pane-mem"),
    pipeline: document.getElementById("pane-pipeline"),
    signals: document.getElementById("pane-signals"),
    console: document.getElementById("pane-console"),
  };

  // Status indicators
  const cycleDisplay = document.getElementById("cycle");
  const hiDisplay = document.getElementById("hi");
  const loDisplay = document.getElementById("lo");
  const loadedDisplay = document.getElementById("loaded");
  const haltedDisplay = document.getElementById("halted");
  const instrCountDisplay = document.getElementById("icount");

  // Program Counter (two separate display locations)
  const pcStatusDisplay = document.getElementById("pc"); // top status bar pill
  const pcRegisterDisplay = document.getElementById("pc2"); // Hi/Lo/PC table

  // Table containers
  const registersTableBody = document.querySelector("#tblRegs tbody");
  const memoryTableBody = document.querySelector("#tblMem tbody");
  const pipelineContainer = document.getElementById("pipe");
  const controlContainer = document.getElementById("signals");
  const consoleContainer = document.getElementById("console");

  // Tab switching
  function showTab(name) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    Object.entries(panes).forEach(([key, pane]) => {
      pane.style.display = key === name ? "block" : "none";
    });
  }
  tabButtons.forEach((btn) =>
    btn.addEventListener("click", () => showTab(btn.dataset.tab))
  );

  // Default Status
  cycleDisplay.textContent = "0";
  hiDisplay.textContent = toHex32(0);
  loDisplay.textContent = toHex32(0);
  loadedDisplay.textContent = "No";
  haltedDisplay.textContent = "No";
  instrCountDisplay.textContent = "0";
  pcStatusDisplay.textContent = toHex32(0);
  pcRegisterDisplay.textContent = toHex32(0);

  // Default Registers
  registersTableBody.innerHTML = "";
  for (let i = 0; i < 32; i++) {
    const row = document.createElement("tr");
    const regName = i === 0 ? "$zero" : `$${i}`;
    row.innerHTML = `<td>${regName}</td><td>${toHex32(0)}</td>`;
    registersTableBody.appendChild(row);
  }

  // Default Memory (first 16 words)
  memoryTableBody.innerHTML = "";
  for (let row = 0; row < 16; row++) {
    const addr = row * 4;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${toHex32(addr)}</td>
      <td>${toHex8(0)}</td>
      <td>${toHex8(0)}</td>
      <td>${toHex8(0)}</td>
      <td>${toHex8(0)}</td>
    `;
    memoryTableBody.appendChild(tr);
  }

  // Default Pipeline
  pipelineContainer.innerHTML = "";
  const pipelineStages = [
    "Instruction Fetch",
    "Instruction Decode",
    "Execute",
    "Memory Access",
    "Write Back",
  ];
  pipelineStages.forEach((stageName) => {
    const stageBox = document.createElement("div");
    stageBox.className = "stage";
    stageBox.innerHTML = `<h4>${stageName}</h4><div class="mono">— idle —</div>`;
    pipelineContainer.appendChild(stageBox);
  });

  // Default Control Signals
  controlContainer.innerHTML = "";
  const controlSignals = [
    "RegWrite: false",
    "MemRead: false",
    "MemWrite: false",
    "MemToReg: false",
    "Branch: false",
    "Jump: false",
  ];
  controlSignals.forEach((signalText) => {
    const signalCard = document.createElement("div");
    signalCard.className = "stage";
    signalCard.innerHTML = `<h4>Signal</h4><div class="mono">${signalText}</div>`;
    controlContainer.appendChild(signalCard);
  });

  // Default Console
  consoleContainer.innerHTML = "";
  const startupMessages = [
    "Welcome to the MIPS Simulator UI.",
    "Paste or load a program to begin.",
    "Use Run ▶ or Step ⏭ to execute instructions.",
  ];
  startupMessages.forEach((msg) => {
    const line = document.createElement("div");
    line.className = "mono";
    line.textContent = `• ${msg}`;
    consoleContainer.appendChild(line);
  });

  // Default visible tab
  showTab("regs");
});
