// MIPS Simulator - Frontend Integration with Backend
document.addEventListener("DOMContentLoaded", () => {
  // Initialize simulator instance
  const simulator = new MIPSSimulator();
 
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

  // Input elements
  const programTextarea = document.getElementById("src");
  const btnLoad = document.getElementById("btnLoad");
  const btnStep = document.getElementById("btnStep");
  const btnRun = document.getElementById("btnRun");
  const btnReset = document.getElementById("btnReset");
  const chkDebug = document.getElementById("chkDebug");

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

  // Memory controls
  const memAddressInput = document.getElementById("memAddress");
  const memPageInput = document.getElementById("memPage");
  const memRowsInput = document.getElementById("memRows");
  const btnMemGoto = document.getElementById("memGoto");
  const btnMemRefresh = document.getElementById("memRefresh");

  // Tab switching
  function showTab(name) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    Object.entries(panes).forEach(([key, pane]) => {
      pane.style.display = key === name ? "block" : "none";
    });
    
    // Refresh data when switching tabs
    switch(name) {
      case "mem":
        updateMemoryDisplay();
        break;
      case "pipeline":
        updatePipeline();
        break;
      case "signals":
        updateControlSignals();
        break;
      case "console":
        updateConsole();
        break;
      case "regs":
        updateRegisters();
        break;
    }
  }
  tabButtons.forEach((btn) =>
    btn.addEventListener("click", () => showTab(btn.dataset.tab))
  );

  // Update status bar
  function updateStatus() {
    // Access state directly from simulator
    cycleDisplay.textContent = simulator.cycle.toString();
    hiDisplay.textContent = toHex32(simulator.HI);
    loDisplay.textContent = toHex32(simulator.LO);
    loadedDisplay.textContent = simulator.loaded ? "Yes" : "No";
    haltedDisplay.textContent = simulator.halted ? "Yes" : "No";
    instrCountDisplay.textContent = simulator.instructionCount.toString();
    pcStatusDisplay.textContent = toHex32(simulator.PC);
    pcRegisterDisplay.textContent = toHex32(simulator.PC);
  }

  // Update registers display
  function updateRegisters() {
    registersTableBody.innerHTML = "";
    
    // Register name mapping (reverse lookup)
    const regNameMap = {
      0: '$zero', 1: '$at', 2: '$v0', 3: '$v1',
      4: '$a0', 5: '$a1', 6: '$a2', 7: '$a3',
      8: '$t0', 9: '$t1', 10: '$t2', 11: '$t3',
      12: '$t4', 13: '$t5', 14: '$t6', 15: '$t7',
      16: '$s0', 17: '$s1', 18: '$s2', 19: '$s3',
      20: '$s4', 21: '$s5', 22: '$s6', 23: '$s7',
      24: '$t8', 25: '$t9', 26: '$k0', 27: '$k1',
      28: '$gp', 29: '$sp', 30: '$fp', 31: '$ra'
    };
    
    // Access registers directly from simulator
    for (let i = 0; i < 32; i++) {
      const row = document.createElement("tr");
      const regNum = `$${i}`;
      const regName = regNameMap[i] || `$${i}`;
      const value = simulator.registers[i] || 0;
      
      // Show both number and name: "$8 ($t0)" or just "$zero" for register 0
      let displayName;
      if (i === 0) {
        displayName = "$zero";
      } else {
        displayName = `${regNum} (${regName})`;
      }
      
      row.innerHTML = `<td>${displayName}</td><td>${toHex32(value)}</td>`;
      registersTableBody.appendChild(row);
    }
  }

  // Update memory display - automatically show used memory
  function updateMemoryDisplay() {
    const rows = parseInt(memRowsInput.value) || 64;
    const bytesPerPage = rows * 4;
    
    // Get the range of memory that has been used
    const memoryRange = simulator.getUsedMemoryRange();
    
    let startAddr;
    let page;
    
    if (memoryRange.hasData && simulator.usedMemoryAddresses.size > 0) {
      // Automatically show the page containing the used memory
      // Center on the first used address
      const firstUsedAddr = memoryRange.min;
      page = Math.floor(firstUsedAddr / bytesPerPage);
      startAddr = page * bytesPerPage;
      
      // Update the page input to match
      memPageInput.value = page;
      
      // Also update address input to show the first used address
      memAddressInput.value = toHex32(firstUsedAddr);
    } else {
      // No memory used yet, show from page 0 or user-specified page
      page = parseInt(memPageInput.value) || 0;
      startAddr = page * bytesPerPage;
    }

  memoryTableBody.innerHTML = "";
    const usedAddresses = Array.from(simulator.usedMemoryAddresses);
    
    for (let row = 0; row < rows; row++) {
      const addr = startAddr + (row * 4);
      if (addr >= simulator.memory.length) break;

      const b0 = simulator.memory[addr] || 0;
      const b1 = simulator.memory[addr + 1] || 0;
      const b2 = simulator.memory[addr + 2] || 0;
      const b3 = simulator.memory[addr + 3] || 0;

    const tr = document.createElement("tr");
      
      // Highlight rows that contain used memory
      const wordUsed = usedAddresses.some(usedAddr => 
        usedAddr >= addr && usedAddr < addr + 4
      );
      
      if (wordUsed) {
        tr.style.backgroundColor = '#2a3a4a'; // Highlight used memory
        tr.style.fontWeight = 'bold';
      }
      
    tr.innerHTML = `
      <td>${toHex32(addr)}</td>
        <td>${toHex8(b0)}</td>
        <td>${toHex8(b1)}</td>
        <td>${toHex8(b2)}</td>
        <td>${toHex8(b3)}</td>
    `;
    memoryTableBody.appendChild(tr);
  }

    // Show a message if memory has been used
    if (memoryRange.hasData) {
      // Add info message above table (we'll add this via a small info div)
      const memInfo = document.querySelector('.mem-info');
      if (memInfo) {
        memInfo.textContent = `Showing memory page ${page} (contains used addresses ${toHex32(memoryRange.min)} - ${toHex32(memoryRange.max)})`;
      }
    }
  }

  // Update pipeline display (showing different instructions in each stage)
  function updatePipeline() {
    const debugLog = simulator.getDebugLog();

  pipelineContainer.innerHTML = "";
  const pipelineStages = [
      { name: "Instruction Fetch", id: "IF", offset: 0 },      // Current instruction
      { name: "Instruction Decode", id: "ID", offset: 1 },     // 1 cycle ago
      { name: "Execute", id: "EX", offset: 2 },                // 2 cycles ago
      { name: "Memory Access", id: "MEM", offset: 3 },         // 3 cycles ago
      { name: "Write Back", id: "WB", offset: 4 },             // 4 cycles ago
    ];

    if (debugLog.length > 0 && simulator.debugMode) {
      // Show different instructions in each stage to simulate pipeline
      pipelineStages.forEach((stage) => {
        const stageBox = document.createElement("div");
        stageBox.className = "stage";
        
        // Get the instruction at the appropriate pipeline position
        const logIndex = debugLog.length - 1 - stage.offset;
        const entry = logIndex >= 0 ? debugLog[logIndex] : null;
        
        if (entry && entry.instruction) {
          const inst = entry.instruction;
          // Skip comments or empty instructions
          if (inst.trim() && !inst.trim().startsWith('#')) {
            const cycle = entry.cycle;
            stageBox.innerHTML = `<h4>${stage.name}</h4><div class="mono">${inst}</div><div class="mono" style="font-size: 11px; color: #9fb1c8; margin-top: 4px;">Cycle ${cycle}</div>`;
          } else {
            // Skip comments/empty - show as idle
            stageBox.innerHTML = `<h4>${stage.name}</h4><div class="mono">— idle —</div>`;
          }
        } else {
          // Stage is empty (before pipeline fills)
          stageBox.innerHTML = `<h4>${stage.name}</h4><div class="mono">— idle —</div>`;
        }
        
        pipelineContainer.appendChild(stageBox);
      });
    } else if (simulator.loaded && simulator.instructionCount > 0) {
      // Show that program has executed but debug mode is off
      pipelineStages.forEach((stage) => {
        const stageBox = document.createElement("div");
        stageBox.className = "stage";
        stageBox.innerHTML = `<h4>${stage.name}</h4><div class="mono">— Enable Debug Mode —</div><div class="mono" style="font-size: 11px; color: #9fb1c8; margin-top: 4px;">${simulator.instructionCount} instruction(s) executed</div>`;
        pipelineContainer.appendChild(stageBox);
      });
    } else {
      // Default idle state
      pipelineStages.forEach((stage) => {
    const stageBox = document.createElement("div");
    stageBox.className = "stage";
        stageBox.innerHTML = `<h4>${stage.name}</h4><div class="mono">— idle —</div>`;
    pipelineContainer.appendChild(stageBox);
  });
    }
  }

  // Update control signals display
  function updateControlSignals() {
    const debugLog = simulator.getDebugLog();
    const lastEntry = debugLog.length > 0 ? debugLog[debugLog.length - 1] : null;

  controlContainer.innerHTML = "";
    
    if (lastEntry && lastEntry.control && simulator.debugMode) {
      // Show control signals from last executed instruction
      const signals = lastEntry.control;
      Object.entries(signals).forEach(([key, value]) => {
        const signalCard = document.createElement("div");
        signalCard.className = "stage";
        const displayValue = typeof value === 'boolean' ? value.toString() : value.toString();
        const color = (typeof value === 'boolean' && value) || (typeof value === 'number' && value !== 0) 
          ? "#4CAF50" 
          : "#888";
        signalCard.innerHTML = `<h4>${key}</h4><div class="mono" style="color: ${color}">${displayValue}</div>`;
        controlContainer.appendChild(signalCard);
      });
    } else if (simulator.loaded && simulator.instructionCount > 0) {
      // Show message if debug mode is off
      const signalCard = document.createElement("div");
      signalCard.className = "stage";
      signalCard.innerHTML = `<h4>Control Signals</h4><div class="mono">Enable Debug Mode to see control signals</div>`;
      controlContainer.appendChild(signalCard);
    } else {
      // Default empty signals
      const defaultSignals = [
        { name: "RegWrite", value: false },
        { name: "MemRead", value: false },
        { name: "MemWrite", value: false },
        { name: "MemToReg", value: false },
        { name: "Branch", value: false },
        { name: "Jump", value: false },
        { name: "ALUSrc", value: false },
        { name: "RegDst", value: false },
        { name: "ALUOp", value: 0 },
      ];
      defaultSignals.forEach((signal) => {
    const signalCard = document.createElement("div");
    signalCard.className = "stage";
        const displayValue = typeof signal.value === 'boolean' ? signal.value.toString() : signal.value.toString();
        signalCard.innerHTML = `<h4>${signal.name}</h4><div class="mono">${displayValue}</div>`;
    controlContainer.appendChild(signalCard);
  });
    }
  }

  // Update console with debug logs or messages
  function updateConsole() {
  consoleContainer.innerHTML = "";
    
    if (simulator.debugMode) {
      const debugLog = simulator.getDebugLog();
      
      if (debugLog.length === 0) {
        const line = document.createElement("div");
        line.className = "mono";
        line.textContent = "• Debug mode enabled. Step through instructions to see detailed logs.";
        consoleContainer.appendChild(line);
      } else {
        // Show debug log entries
        debugLog.forEach((entry, index) => {
          const logEntry = document.createElement("div");
          logEntry.className = "mono";
          logEntry.style.marginBottom = "8px";
          logEntry.style.paddingBottom = "8px";
          logEntry.style.borderBottom = "1px solid #1b2026";
          logEntry.style.whiteSpace = "pre-wrap";
          
          let logText = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          logText += `[Cycle ${entry.cycle}] PC: ${entry.PC}\n`;
          logText += `Instruction: ${entry.instruction}\n`;
          logText += `Binary: ${entry.binary}\n`;
          logText += `Hex: ${entry.hex}\n\n`;
          logText += `Control Signals:\n`;
          Object.entries(entry.control).forEach(([k, v]) => {
            logText += `  ${k}: ${v}\n`;
          });
          
          logEntry.textContent = logText;
          consoleContainer.appendChild(logEntry);
        });
      }
      
      // Also show regular console messages if any
      if (consoleMessages.length > 0) {
        consoleMessages.forEach(({ message, type }) => {
          const line = document.createElement("div");
          line.className = "mono";
          const prefix = type === "error" ? "✗ " : type === "success" ? "✓ " : "• ";
          line.textContent = prefix + message;
          if (type === "error") {
            line.style.color = "#ff6b6b";
          } else if (type === "success") {
            line.style.color = "#4CAF50";
          }
          line.style.marginBottom = "4px";
          consoleContainer.appendChild(line);
        });
      }
    } else {
      // Show console messages when debug mode is off
      if (consoleMessages.length > 0) {
        consoleMessages.forEach(({ message, type }) => {
          const line = document.createElement("div");
          line.className = "mono";
          const prefix = type === "error" ? "✗ " : type === "success" ? "✓ " : "• ";
          line.textContent = prefix + message;
          if (type === "error") {
            line.style.color = "#ff6b6b";
          } else if (type === "success") {
            line.style.color = "#4CAF50";
          }
          line.style.marginBottom = "4px";
          consoleContainer.appendChild(line);
        });
      } else {
        // Default startup messages
        if (simulator.loaded) {
          const line1 = document.createElement("div");
          line1.className = "mono";
          line1.textContent = `• Program loaded with ${simulator.instructions.length} instruction(s).`;
          consoleContainer.appendChild(line1);
          
          const line2 = document.createElement("div");
          line2.className = "mono";
          line2.textContent = `• Use Step ⏭ or Run ▶ to execute.`;
          consoleContainer.appendChild(line2);
        } else {
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
        }
      }
    }
  }

  // Update all UI elements
  function updateUI() {
    updateStatus();
    updateRegisters();
    updateMemoryDisplay();
    updatePipeline();
    updateControlSignals();
    updateConsole();
  }

  // Store console messages
  let consoleMessages = [];

  // Add message to console
  function addConsoleMessage(message, type = "info") {
    // Store message
    consoleMessages.push({ message, type });
    
    // Update console display
    updateConsole();
    
    // Auto-scroll to bottom
    setTimeout(() => {
      consoleContainer.scrollTop = consoleContainer.scrollHeight;
    }, 10);
  }

  // Load program
  btnLoad.addEventListener("click", () => {
    const programText = programTextarea.value.trim();
    if (!programText) {
      addConsoleMessage("No program entered.", "error");
      return;
    }

    try {
      // Clear console messages before loading new program
      consoleMessages = [];
      
      // Reset simulator state before loading new program
      simulator.reset();
      simulator.loaded = false; // Allow loading
      
      const result = simulator.loadProgram(programText);
      addConsoleMessage(`Program loaded successfully! ${result.instructions} instruction(s) parsed.`, "success");
      
      // Show instruction listing (only first 50 to avoid console spam)
      const listing = simulator.getListing();
      addConsoleMessage(`Instruction Listing (${listing.length} total):`);
      
      if (listing.length > 50) {
        // Show first 25 and last 25
        for (let i = 0; i < 25; i++) {
          addConsoleMessage(`  ${listing[i].address}: ${listing[i].hex} | ${listing[i].assembly}`);
        }
        addConsoleMessage(`  ... (${listing.length - 50} instructions omitted) ...`);
        for (let i = listing.length - 25; i < listing.length; i++) {
          addConsoleMessage(`  ${listing[i].address}: ${listing[i].hex} | ${listing[i].assembly}`);
        }
      } else {
        // Show all if less than 50
        listing.forEach((inst, idx) => {
          addConsoleMessage(`  ${inst.address}: ${inst.hex} | ${inst.assembly}`);
        });
      }
      
      updateUI();
    } catch (error) {
      addConsoleMessage(`Error loading program: ${error.message}`, "error");
      console.error("Load error:", error);
    }
  });

  // Step through one instruction
  btnStep.addEventListener("click", () => {
    if (!simulator.loaded) {
      addConsoleMessage("Please load a program first.", "error");
      return;
    }

    if (simulator.halted) {
      addConsoleMessage("Program is halted. Reset to run again.", "error");
      return;
    }

    try {
      const result = simulator.step();
      if (result.success) {
        const inst = result.instruction;
        const exec = result.executionResult;
        
        if (simulator.debugMode) {
          addConsoleMessage(`Executed: ${inst.originalLine || inst.mnemonic} at ${toHex32(result.executionResult.nextPC - 4)}`, "success");
        }
        
        updateUI();
        
        if (simulator.halted) {
          addConsoleMessage("Program halted.", "info");
        }
      } else {
        addConsoleMessage(result.message, "error");
        if (result.halted) {
          updateUI();
        }
      }
    } catch (error) {
      addConsoleMessage(`Error executing instruction: ${error.message}`, "error");
      console.error("Step error:", error);
    }
  });

  // Run entire program
  btnRun.addEventListener("click", () => {
    if (!simulator.loaded) {
      addConsoleMessage("Please load a program first.", "error");
      return;
    }

    if (simulator.halted) {
      addConsoleMessage("Program is halted. Reset to run again.", "error");
      return;
    }

    try {
      const result = simulator.run();
      if (result.success) {
        addConsoleMessage(`Program completed. Executed ${result.steps} instruction(s).`, "success");
        updateUI();
      } else {
        addConsoleMessage(result.message, "error");
        updateUI();
      }
    } catch (error) {
      addConsoleMessage(`Error running program: ${error.message}`, "error");
      console.error("Run error:", error);
    }
  });

  // Reset simulator
  btnReset.addEventListener("click", () => {
    simulator.reset();
    programTextarea.value = "";
    consoleMessages = []; // Clear console messages
    addConsoleMessage("Simulator reset.", "info");
    updateUI();
  });

  // Debug mode toggle
  chkDebug.addEventListener("change", () => {
    simulator.setDebugMode(chkDebug.checked);
    if (chkDebug.checked) {
      addConsoleMessage("Debug mode enabled.", "info");
    } else {
      addConsoleMessage("Debug mode disabled.", "info");
    }
    updateConsole();
  });

  // Memory goto address button
  btnMemGoto.addEventListener("click", () => {
    const addrStr = memAddressInput.value.trim();
    if (!addrStr) return;
    
    // Parse hex address (with or without 0x prefix)
    let addr;
    if (addrStr.startsWith('0x') || addrStr.startsWith('0X')) {
      addr = parseInt(addrStr, 16);
    } else {
      addr = parseInt(addrStr, 16); // Try hex first
      if (isNaN(addr)) {
        addr = parseInt(addrStr, 10); // Fall back to decimal
      }
    }
    
    if (isNaN(addr) || addr < 0) {
      addConsoleMessage(`Invalid address: ${addrStr}`, "error");
      return;
    }
    
    // Calculate page number
    const rows = parseInt(memRowsInput.value) || 64;
    const bytesPerPage = rows * 4;
    const page = Math.floor(addr / bytesPerPage);
    
    memPageInput.value = page;
    updateMemoryDisplay();
    
    // Scroll to the specific row
    setTimeout(() => {
      const rowIndex = Math.floor((addr % bytesPerPage) / 4);
      const tableRow = memoryTableBody.children[rowIndex];
      if (tableRow) {
        tableRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the row briefly
        tableRow.style.backgroundColor = '#3a4a5a';
        setTimeout(() => {
          tableRow.style.backgroundColor = '';
        }, 1000);
      }
    }, 100);
  });

  // Memory refresh button
  btnMemRefresh.addEventListener("click", () => {
    updateMemoryDisplay();
  });
  
  // Show used memory button
  const btnMemShowUsed = document.getElementById("memShowUsed");
  btnMemShowUsed.addEventListener("click", () => {
    const memoryRange = simulator.getUsedMemoryRange();
    if (memoryRange.hasData) {
      memAddressInput.value = toHex32(memoryRange.min);
      btnMemGoto.click();
      addConsoleMessage(`Jumped to first used memory address: ${toHex32(memoryRange.min)}`, "info");
    } else {
      addConsoleMessage("No memory has been accessed yet.", "info");
    }
  });
  
  // Enter key on address input
  memAddressInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      btnMemGoto.click();
    }
  });
  
  // Initialize UI
  updateUI();
  showTab("regs");
});