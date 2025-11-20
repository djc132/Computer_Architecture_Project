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

## References & Resources

The backend development was based on the following resources:

### MIPS Architecture & Instruction Set
- **MIPS Instruction Set Reference**: MIPS32 Architecture documentation for instruction formats, opcodes, and function codes
- **R-type, I-type, J-type Formats**: Standard MIPS instruction encoding formats
  - R-type: opcode (6 bits) + rs (5) + rt (5) + rd (5) + shamt (5) + funct (6)
  - I-type: opcode (6 bits) + rs (5) + rt (5) + immediate (16)
  - J-type: opcode (6 bits) + address (26)

### MIPS Simulators (Reference for UI/UX)
- **CPUlator**: https://cpulator.01xz.net/?sys=mips-r3000
  - Used as reference for simulator interface design and control signal display

### MIPS Register Conventions
- Standard MIPS register naming conventions ($zero, $at, $v0-$v1, $a0-$a3, $t0-$t9, $s0-$s7, $k0-$k1, $gp, $sp, $fp, $ra)
- Special registers: HI, LO (for multiply/divide operations)
- Program Counter (PC) conventions (typically starts at 0x00400000 for text segment)

### Implementation Notes
- Instruction semantics follow standard MIPS architecture specifications
- Memory is byte-addressable with word-alignment for load/store operations
- Immediate values use sign extension for I-type instructions
- Branch offsets are PC-relative (calculated as instruction difference)
- Jump addresses use upper 4 bits of PC + 26-bit address field

### Additional Resources
- MIPS Assembly Language Reference - Official MIPS documentation
- Standard MIPS calling conventions and register usage
