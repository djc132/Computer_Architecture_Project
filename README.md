# MIPS Simulator

A web-based MIPS processor simulator for executing MIPS assembly programs.

## Quick Start

### Running the Simulator

1. Open a terminal in the project directory
2. Start a local web server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8000/MIPS_Sim_UI.html
   ```

## Usage

### Loading a Program

1. Paste your MIPS assembly code into the text area
2. Click **"Load"** to parse and load the program
3. View the instruction listing with binary/hex representations

### Executing Instructions

- **Step ⏭** - Execute one instruction at a time
- **Run ▶** - Execute all instructions until completion
- **Reset ⟲** - Reset the simulator to initial state

### Features

- **Registers Tab** - View all 32 general-purpose registers and HI/LO/PC
- **Memory Tab** - View memory contents (automatically shows used memory)
- **Pipeline Tab** - See instruction pipeline stages (requires Debug Mode)
- **Control Tab** - View control signals for instructions (requires Debug Mode)
- **Console Tab** - View execution logs and messages
- **Debug Mode** - Enable detailed execution logging

## Files

- `Example_Assembly.txt` - Example code to use in the UI
- `MIPS_Sim_UI.html` - Main user interface
- `MIPS_Sim_Backend.js` - Simulator engine (parsing, encoding, execution)
- `MIPS_Sim_Script.js` - Frontend integration
- `MIPS_Sim_Style.css` - Styling
