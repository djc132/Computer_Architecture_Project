// MIPS Simulator Backend
// Handles parsing, binary encoding, and execution of MIPS assembly programs

class MIPSSimulator {
  constructor() {
    // Processor State
    this.registers = new Uint32Array(32); // 32 general-purpose registers
    this.memory = new Uint8Array(0x10000); // 64KB memory (byte-addressable)
    this.PC = 0x00400000; // Program counter starts at 0x00400000
    this.LO = 0;
    
    // Execution State
    this.instructions = []; // Parsed instructions with binary encoding
    this.loaded = false;
    this.halted = false;
    this.cycle = 0;
    this.instructionCount = 0;
    
    // Debug
    this.debugMode = false;
    this.debugLog = [];
    
    // Track memory usage
    this.usedMemoryAddresses = new Set(); // Track all addresses that have been accessed
    
    // Register name mapping
    this.regNames = {
      '$zero': 0, '$at': 1, '$v0': 2, '$v1': 3,
      '$a0': 4, '$a1': 5, '$a2': 6, '$a3': 7,
      '$t0': 8, '$t1': 9, '$t2': 10, '$t3': 11,
      '$t4': 12, '$t5': 13, '$t6': 14, '$t7': 15,
      '$s0': 16, '$s1': 17, '$s2': 18, '$s3': 19,
      '$s4': 20, '$s5': 21, '$s6': 22, '$s7': 23,
      '$t8': 24, '$t9': 25, '$k0': 26, '$k1': 27,
      '$gp': 28, '$sp': 29, '$fp': 30, '$ra': 31
    };
    
    // Instruction opcodes and function codes
    this.opcodes = {
      'R': 0x00,
      'j': 0x02, 'jal': 0x03,
      'beq': 0x04, 'bne': 0x05, 'blez': 0x06, 'bgtz': 0x07,
      'addi': 0x08, 'addiu': 0x09, 'slti': 0x0a, 'sltiu': 0x0b,
      'andi': 0x0c, 'ori': 0x0d, 'xori': 0x0e, 'lui': 0x0f,
      'lb': 0x20, 'lh': 0x21, 'lwl': 0x22, 'lw': 0x23,
      'lbu': 0x24, 'lhu': 0x25, 'lwr': 0x26,
      'sb': 0x28, 'sh': 0x29, 'swl': 0x2a, 'sw': 0x2b, 'swr': 0x2e
    };
    
    this.functCodes = {
      'sll': 0x00, 'srl': 0x02, 'sra': 0x03, 'sllv': 0x04,
      'srlv': 0x06, 'srav': 0x07, 'jr': 0x08, 'jalr': 0x09,
      'syscall': 0x0c, 'mfhi': 0x10, 'mthi': 0x11, 'mflo': 0x12,
      'mtlo': 0x13, 'mult': 0x18, 'multu': 0x19, 'div': 0x1a,
      'divu': 0x1b, 'add': 0x20, 'addu': 0x21, 'sub': 0x22,
      'subu': 0x23, 'and': 0x24, 'or': 0x25, 'xor': 0x26,
      'nor': 0x27, 'slt': 0x2a, 'sltu': 0x2b
    };
  }
  
   // Convert register name or number to register index

  parseRegister(reg) {
    // Trim whitespace and remove trailing commas
    if (typeof reg !== 'string') {
      reg = String(reg);
    }
    reg = reg.trim().replace(/,$/, '');
    
    // Handle $0, $1, ..., $31
    if (reg.startsWith('$')) {
      // Try to parse as numeric register first (e.g., $0, $1, ..., $31)
      const numStr = reg.slice(1);
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num >= 0 && num < 32 && /^\d+$/.test(numStr)) {
        return num;
      }
      // Handle named registers (e.g., $zero, $t0, $sp, etc.)
      const lower = reg.toLowerCase();
      if (this.regNames[lower] !== undefined) {
        return this.regNames[lower];
      }
    }
    throw new Error(`Invalid register: ${reg}`);
  }
  
   // Parse immediate value (supports decimal, hex, binary)
  
  parseImmediate(imm) {
    if (typeof imm === 'number') return imm;
    imm = imm.trim();
    if (imm.startsWith('0x') || imm.startsWith('0X')) {
      return parseInt(imm, 16);
    }
    if (imm.startsWith('0b') || imm.startsWith('0B')) {
      return parseInt(imm.slice(2), 2);
    }
    return parseInt(imm, 10);
  }
  
   // Parse a line of assembly code
 
  parseLine(line) {
    // Remove comments
    line = line.split('#')[0].trim();
    if (!line) return null;
    
    // Handle labels (e.g., "loop: add $1, $2, $3")
    let label = null;
    const labelMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (labelMatch) {
      label = labelMatch[1];
      line = labelMatch[2].trim();
      if (!line) return { type: 'label', label };
    }
    
    // Split into tokens
    const tokens = line.match(/\S+/g) || [];
    if (tokens.length === 0) return label ? { type: 'label', label } : null;
    
    const mnemonic = tokens[0].toLowerCase();
    const args = tokens.slice(1);
    
    // Parse arguments (handling different formats)
    const parseArgs = () => {
      const parsed = [];
      for (let arg of args) {
        // Strip trailing commas
        arg = arg.replace(/,$/, '').trim();
        // Handle "($reg)" format like in lw/sw
        const offsetRegMatch = arg.match(/^(-?\d+)\(([^)]+)\)$/);
        if (offsetRegMatch) {
          parsed.push({ type: 'offset_reg', offset: parseInt(offsetRegMatch[1]), reg: offsetRegMatch[2].trim() });
        } else {
          parsed.push(arg);
        }
      }
      return parsed;
    };
    
    return { type: 'instruction', mnemonic, args: parseArgs(), label };
  }
  
   // Encode R-type instruction to binary
  
  encodeRType(mnemonic, rd, rs, rt, shamt = 0) {
    const opcode = this.opcodes['R'];
    const funct = this.functCodes[mnemonic] || 0;
    const rdNum = this.parseRegister(rd);
    const rsNum = this.parseRegister(rs);
    const rtNum = this.parseRegister(rt);
    
    let instruction = 0;
    instruction |= (opcode << 26);
    instruction |= (rsNum << 21);
    instruction |= (rtNum << 16);
    instruction |= (rdNum << 11);
    instruction |= (shamt << 6);
    instruction |= funct;
    
    return instruction >>> 0; // Convert to unsigned 32-bit
  }
  
   // Encode I-type instruction to binary
   
  encodeIType(mnemonic, rt, rs, immediate) {
    const opcode = this.opcodes[mnemonic];
    if (opcode === undefined) throw new Error(`Unknown I-type instruction: ${mnemonic}`);
    
    const rtNum = this.parseRegister(rt);
    const rsNum = this.parseRegister(rs);
    const imm = this.parseImmediate(immediate);
    const imm16 = (imm < 0) ? (imm & 0xffff) : imm; // Sign extend for negative
    
    let instruction = 0;
    instruction |= (opcode << 26);
    instruction |= (rsNum << 21);
    instruction |= (rtNum << 16);
    instruction |= (imm16 & 0xffff);
    
    return instruction >>> 0;
  }
  
   // Encode J-type instruction to binary
  
  encodeJType(mnemonic, address) {
    const opcode = this.opcodes[mnemonic];
    if (opcode === undefined) throw new Error(`Unknown J-type instruction: ${mnemonic}`);
    
    // For now, assume address is a label (will be resolved later)
    // Or it could be an immediate value
    const addr = typeof address === 'number' ? address : address;
    const addr26 = (addr >>> 2) & 0x3ffffff; // Lower 26 bits, word-aligned
    
    let instruction = 0;
    instruction |= (opcode << 26);
    instruction |= addr26;
    
    return instruction >>> 0;
  }
  
   // Encode an instruction to binary based on its type
   
  encodeInstruction(parsed) {
    if (parsed.type !== 'instruction') return null;
    
    const { mnemonic, args } = parsed;
    
    try {
      switch (mnemonic) {
        // R-type instructions
        case 'add': case 'addu':
        case 'sub': case 'subu':
        case 'and': case 'or': case 'xor': case 'nor':
        case 'slt': case 'sltu':
          if (args.length !== 3) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType(mnemonic, args[0], args[2], args[1]);
        
        case 'sll': case 'srl': case 'sra':
          if (args.length !== 3) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType(mnemonic, args[0], args[1], '$zero', this.parseImmediate(args[2]));
        
        case 'sllv': case 'srlv': case 'srav':
          if (args.length !== 3) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType(mnemonic, args[0], args[2], args[1]);
        
        case 'jr':
          if (args.length !== 1) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType('jr', '$zero', args[0], '$zero');
        
        case 'mfhi': case 'mflo':
          if (args.length !== 1) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType(mnemonic, args[0], '$zero', '$zero');
        
        case 'mult': case 'multu': case 'div': case 'divu':
          if (args.length !== 2) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeRType(mnemonic, '$zero', args[0], args[1]);
        
        case 'syscall':
          return this.encodeRType('syscall', '$zero', '$zero', '$zero');
        
        case 'nop':
          return 0; // NOP is 0x00000000
        
        // I-type instructions
        case 'addi': case 'addiu':
        case 'andi': case 'ori': case 'xori':
        case 'slti': case 'sltiu':
          if (args.length !== 3) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeIType(mnemonic, args[0], args[1], args[2]);
        
        case 'lui':
          if (args.length !== 2) throw new Error(`Invalid arguments for ${mnemonic}`);
          return this.encodeIType('lui', args[0], '$zero', args[1]);
        
        case 'lw': case 'lh': case 'lb':
        case 'sw': case 'sh': case 'sb':
          if (args.length !== 2) throw new Error(`Invalid arguments for ${mnemonic}`);
          const offsetReg = args[1];
          if (offsetReg.type !== 'offset_reg') throw new Error(`Invalid memory access format`);
          return this.encodeIType(mnemonic === 'lw' ? 'lw' : mnemonic === 'sw' ? 'sw' :
                                  mnemonic === 'lh' ? 'lh' : mnemonic === 'lb' ? 'lb' :
                                  mnemonic === 'sh' ? 'sh' : 'sb',
                                  args[0], offsetReg.reg, offsetReg.offset);
        
        case 'beq': case 'bne':
          if (args.length !== 3) throw new Error(`Invalid arguments for ${mnemonic}`);
          // For now, treat label as immediate 0 (will be resolved during execution)
          return { type: 'branch', mnemonic, args, encoded: null };
        
        case 'bgtz': case 'blez':
          if (args.length !== 2) throw new Error(`Invalid arguments for ${mnemonic}`);
          return { type: 'branch', mnemonic, args, encoded: null };
        
        // J-type instructions
        case 'j': case 'jal':
          if (args.length !== 1) throw new Error(`Invalid arguments for ${mnemonic}`);
          return { type: 'jump', mnemonic, args, encoded: null };
        
        default:
          throw new Error(`Unknown instruction: ${mnemonic}`);
      }
    } catch (error) {
      throw new Error(`Error encoding ${mnemonic}: ${error.message}`);
    }
  }
  
   // Load and parse an assembly program
   
  loadProgram(assemblyText) {
    const lines = assemblyText.split('\n');
    const program = [];
    const labels = {}; // Map labels to instruction indices
    
    // First pass: collect labels and parse instructions
    let instructionIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const parsed = this.parseLine(lines[i]);
      if (!parsed) continue;
      
      if (parsed.type === 'label') {
        labels[parsed.label] = instructionIndex;
      } else if (parsed.type === 'instruction') {
        if (parsed.label) {
          labels[parsed.label] = instructionIndex;
        }
        program.push(parsed);
        instructionIndex++;
      }
    }
    
    // Second pass: encode instructions and resolve labels
    this.instructions = [];
    for (let i = 0; i < program.length; i++) {
      const parsed = program[i];
      const encoded = this.encodeInstruction(parsed);
      
      if (encoded && typeof encoded === 'object') {
        // Branch or jump - resolve label
        if (encoded.type === 'branch') {
          const label = encoded.args[encoded.args.length - 1];
          if (typeof label === 'string' && labels[label] !== undefined) {
            const offset = labels[label] - i - 1; // PC-relative offset
            const args = [...encoded.args];
            args[args.length - 1] = offset;
            const mnemonic = encoded.mnemonic;
            if (mnemonic === 'beq' || mnemonic === 'bne') {
              encoded.encoded = this.encodeIType(mnemonic, args[0], args[1], args[2]);
            } else {
              encoded.encoded = this.encodeIType(mnemonic, args[0], args[0], args[1]);
            }
          } else {
            throw new Error(`Undefined label: ${label}`);
          }
        } else if (encoded.type === 'jump') {
          const label = encoded.args[0];
          if (typeof label === 'string' && labels[label] !== undefined) {
            const addr = 0x00400000 + (labels[label] * 4); // Address of target instruction
            encoded.encoded = this.encodeJType(encoded.mnemonic, addr);
          } else {
            throw new Error(`Undefined label: ${label}`);
          }
        }
        this.instructions.push({
          ...parsed,
          binary: encoded.encoded,
          address: this.PC + (i * 4),
          originalLine: lines.find(l => l.trim() === `${parsed.label ? parsed.label + ': ' : ''}${parsed.mnemonic} ${parsed.args.map(a => typeof a === 'object' ? `${a.offset}(${a.reg})` : a).join(', ')}`.trim()) || lines[i]
        });
      } else if (encoded !== null) {
        this.instructions.push({
          ...parsed,
          binary: encoded,
          address: this.PC + (i * 4),
          originalLine: lines[i]
        });
      }
    }
    
    // Store labels for execution
    this.labels = labels;
    this.loaded = true;
    this.halted = false;
    this.cycle = 0;
    this.instructionCount = 0;
    this.debugLog = []; // Clear debug log when loading new program
    this.usedMemoryAddresses.clear(); // Clear memory usage tracking
    
    return { success: true, instructions: this.instructions.length };
  }
  
   // Read from memory (byte-addressable)
  
  readMemory(address) {
    const addr = address >>> 0; // Convert to unsigned
    if (addr < this.memory.length) {
      // Track this address as used (for reads)
      this.usedMemoryAddresses.add(addr);
      return this.memory[addr];
    }
    return 0;
  }
  
   // Write to memory (byte-addressable)
  
  writeMemory(address, value) {
    const addr = address >>> 0;
    if (addr < this.memory.length) {
      this.memory[addr] = value & 0xff;
      // Track this address as used
      this.usedMemoryAddresses.add(addr);
    }
  }
  
   // Read word from memory (aligned)
  
  readWord(address) {
    const addr = address & ~0x3; // Align to word boundary
    const b0 = this.readMemory(addr);
    const b1 = this.readMemory(addr + 1);
    const b2 = this.readMemory(addr + 2);
    const b3 = this.readMemory(addr + 3);
    return (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
  }
  
   // Write word to memory (aligned)
  
  writeWord(address, value) {
    const addr = address & ~0x3; // Align to word boundary
    this.writeMemory(addr, (value >>> 24) & 0xff);
    this.writeMemory(addr + 1, (value >>> 16) & 0xff);
    this.writeMemory(addr + 2, (value >>> 8) & 0xff);
    this.writeMemory(addr + 3, value & 0xff);
  }
  
   // Sign extend 16-bit to 32-bit
  
  signExtend16(value) {
    return (value << 16) >> 16;
  }
  
   // Extract fields from instruction
  
  decodeInstruction(instruction) {
    const opcode = (instruction >>> 26) & 0x3f;
    const rs = (instruction >>> 21) & 0x1f;
    const rt = (instruction >>> 16) & 0x1f;
    const rd = (instruction >>> 11) & 0x1f;
    const shamt = (instruction >>> 6) & 0x1f;
    const funct = instruction & 0x3f;
    const immediate = instruction & 0xffff;
    const address = instruction & 0x3ffffff;
    
    return { opcode, rs, rt, rd, shamt, funct, immediate, address };
  }
  
   // Generate control signals for an instruction
  
  generateControlSignals(decoded) {
    const signals = {
      RegWrite: false,
      MemRead: false,
      MemWrite: false,
      MemToReg: false,
      Branch: false,
      Jump: false,
      ALUSrc: false,
      RegDst: false,
      ALUOp: 0
    };
    
    // R-type instructions
    if (decoded.opcode === 0x00) {
      signals.RegWrite = true;
      signals.RegDst = true;
      signals.ALUOp = 2; // ALU control for R-type
    }
    // lw
    else if (decoded.opcode === 0x23) {
      signals.RegWrite = true;
      signals.MemRead = true;
      signals.MemToReg = true;
      signals.ALUSrc = true;
      signals.ALUOp = 0; // Add for address calculation
    }
    // sw
    else if (decoded.opcode === 0x2b) {
      signals.MemWrite = true;
      signals.ALUSrc = true;
      signals.ALUOp = 0; // Add for address calculation
    }
    // beq, bne
    else if (decoded.opcode === 0x04 || decoded.opcode === 0x05) {
      signals.Branch = true;
      signals.ALUOp = 1; // Subtract for comparison
    }
    // j, jal
    else if (decoded.opcode === 0x02 || decoded.opcode === 0x03) {
      signals.Jump = true;
      if (decoded.opcode === 0x03) signals.RegWrite = true; // jal writes to $ra
    }
    // I-type arithmetic/logical
    else if ([0x08, 0x09, 0x0c, 0x0d, 0x0e, 0x0a, 0x0b].includes(decoded.opcode)) {
      signals.RegWrite = true;
      signals.ALUSrc = true;
      signals.ALUOp = decoded.opcode === 0x08 || decoded.opcode === 0x09 ? 0 : // addi
                      decoded.opcode === 0x0c ? 2 : // andi (logical)
                      decoded.opcode === 0x0d ? 2 : // ori
                      decoded.opcode === 0x0e ? 2 : // xori
                      2; // slti
    }
    
    return signals;
  }
  
   // Execute a single instruction
  
  executeInstruction(instruction, address) {
    if (!instruction || instruction.binary === undefined) {
      throw new Error('Invalid instruction');
    }
    
    const binary = instruction.binary;
    const decoded = this.decodeInstruction(binary);
    const control = this.generateControlSignals(decoded);
    
    const { mnemonic, args } = instruction;
    
    // Execute based on instruction type
    let nextPC = this.PC + 4;
    let branchTaken = false;
    
    switch (mnemonic) {
      // Arithmetic R-type
      case 'add':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[2])] + this.registers[this.parseRegister(args[1])]) >>> 0;
        break;
      case 'sub':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[2])] - this.registers[this.parseRegister(args[1])]) >>> 0;
        break;
      case 'addu':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[2])] + this.registers[this.parseRegister(args[1])]) >>> 0;
        break;
      case 'subu':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[2])] - this.registers[this.parseRegister(args[1])]) >>> 0;
        break;
      
      // Logical R-type
      case 'and':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[2])] & this.registers[this.parseRegister(args[1])];
        break;
      case 'or':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[2])] | this.registers[this.parseRegister(args[1])];
        break;
      case 'xor':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[2])] ^ this.registers[this.parseRegister(args[1])];
        break;
      case 'nor':
        this.registers[this.parseRegister(args[0])] = 
          ~(this.registers[this.parseRegister(args[2])] | this.registers[this.parseRegister(args[1])]);
        break;
      
      // Shift R-type
      case 'sll':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] << this.parseImmediate(args[2])) >>> 0;
        break;
      case 'srl':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] >>> this.parseImmediate(args[2])) >>> 0;
        break;
      case 'sra':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] >> this.parseImmediate(args[2])) >>> 0;
        break;
      case 'sllv':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] << (this.registers[this.parseRegister(args[2])] & 0x1f)) >>> 0;
        break;
      case 'srlv':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] >>> (this.registers[this.parseRegister(args[2])] & 0x1f)) >>> 0;
        break;
      case 'srav':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[1])] >> (this.registers[this.parseRegister(args[2])] & 0x1f)) >>> 0;
        break;
      
      // Comparison
      case 'slt':
        this.registers[this.parseRegister(args[0])] = 
          ((this.registers[this.parseRegister(args[2])] | 0) < (this.registers[this.parseRegister(args[1])] | 0)) ? 1 : 0;
        break;
      case 'sltu':
        this.registers[this.parseRegister(args[0])] = 
          (this.registers[this.parseRegister(args[2])] < this.registers[this.parseRegister(args[1])]) ? 1 : 0;
        break;
      
      // Multiply/Divide
      case 'mult': {
        const rsVal = this.registers[this.parseRegister(args[0])] | 0;
        const rtVal = this.registers[this.parseRegister(args[1])] | 0;
        const result = BigInt(rsVal) * BigInt(rtVal);
        this.HI = Number(result >> 32n) >>> 0;
        this.LO = Number(result & 0xffffffffn) >>> 0;
        break;
      }
      case 'multu': {
        const rsVal = this.registers[this.parseRegister(args[0])];
        const rtVal = this.registers[this.parseRegister(args[1])];
        const result = BigInt(rsVal) * BigInt(rtVal);
        this.HI = Number(result >> 32n) >>> 0;
        this.LO = Number(result & 0xffffffffn) >>> 0;
        break;
      }
      case 'div': {
        const rsVal = this.registers[this.parseRegister(args[0])] | 0;
        const rtVal = this.registers[this.parseRegister(args[1])] | 0;
        if (rtVal !== 0) {
          this.LO = Math.floor(rsVal / rtVal) >>> 0;
          this.HI = (rsVal % rtVal) >>> 0;
        }
        break;
      }
      case 'divu': {
        const rsVal = this.registers[this.parseRegister(args[0])];
        const rtVal = this.registers[this.parseRegister(args[1])];
        if (rtVal !== 0) {
          this.LO = Math.floor(rsVal / rtVal) >>> 0;
          this.HI = (rsVal % rtVal) >>> 0;
        }
        break;
      }
      case 'mfhi':
        this.registers[this.parseRegister(args[0])] = this.HI;
        break;
      case 'mflo':
        this.registers[this.parseRegister(args[0])] = this.LO;
        break;
      
      // I-type arithmetic/logical
      case 'addi': {
        const rsVal = this.registers[this.parseRegister(args[1])] | 0;
        const imm = this.signExtend16(this.parseImmediate(args[2]));
        this.registers[this.parseRegister(args[0])] = (rsVal + imm) >>> 0;
        break;
      }
      case 'addiu': {
        const rsVal = this.registers[this.parseRegister(args[1])];
        const imm = this.signExtend16(this.parseImmediate(args[2]));
        this.registers[this.parseRegister(args[0])] = (rsVal + imm) >>> 0;
        break;
      }
      case 'andi':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[1])] & (this.parseImmediate(args[2]) & 0xffff);
        break;
      case 'ori':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[1])] | (this.parseImmediate(args[2]) & 0xffff);
        break;
      case 'xori':
        this.registers[this.parseRegister(args[0])] = 
          this.registers[this.parseRegister(args[1])] ^ (this.parseImmediate(args[2]) & 0xffff);
        break;
      case 'slti': {
        const rsVal = this.registers[this.parseRegister(args[1])] | 0;
        const imm = this.signExtend16(this.parseImmediate(args[2]));
        this.registers[this.parseRegister(args[0])] = (rsVal < imm) ? 1 : 0;
        break;
      }
      case 'sltiu': {
        const rsVal = this.registers[this.parseRegister(args[1])];
        const imm = this.parseImmediate(args[2]) & 0xffff;
        this.registers[this.parseRegister(args[0])] = (rsVal < imm) ? 1 : 0;
        break;
      }
      case 'lui':
        this.registers[this.parseRegister(args[0])] = (this.parseImmediate(args[1]) << 16) >>> 0;
        break;
      
      // Memory access
      case 'lw': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        this.registers[this.parseRegister(args[0])] = this.readWord(addr);
        break;
      }
      case 'sw': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        this.writeWord(addr, this.registers[this.parseRegister(args[0])]);
        break;
      }
      case 'lb': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        const byteVal = this.readMemory(addr);
        this.registers[this.parseRegister(args[0])] = this.signExtend16(byteVal);
        break;
      }
      case 'sb': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        this.writeMemory(addr, this.registers[this.parseRegister(args[0])] & 0xff);
        break;
      }
      case 'lh': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        const b0 = this.readMemory(addr);
        const b1 = this.readMemory(addr + 1);
        const halfword = (b0 << 8) | b1;
        this.registers[this.parseRegister(args[0])] = this.signExtend16(halfword);
        break;
      }
      case 'sh': {
        const baseReg = this.registers[this.parseRegister(args[1].reg)];
        const offset = args[1].offset;
        const addr = (baseReg + offset) >>> 0;
        const value = this.registers[this.parseRegister(args[0])];
        this.writeMemory(addr, (value >>> 8) & 0xff);
        this.writeMemory(addr + 1, value & 0xff);
        break;
      }
      
      // Branch instructions
      case 'beq': {
        const rsVal = this.registers[this.parseRegister(args[0])];
        const rtVal = this.registers[this.parseRegister(args[1])];
        const offset = this.signExtend16(decoded.immediate);
        if (rsVal === rtVal) {
          nextPC = this.PC + 4 + (offset << 2);
          branchTaken = true;
        }
        break;
      }
      case 'bne': {
        const rsVal = this.registers[this.parseRegister(args[0])];
        const rtVal = this.registers[this.parseRegister(args[1])];
        const offset = this.signExtend16(decoded.immediate);
        if (rsVal !== rtVal) {
          nextPC = this.PC + 4 + (offset << 2);
          branchTaken = true;
        }
        break;
      }
      case 'bgtz': {
        const rsVal = this.registers[this.parseRegister(args[0])] | 0;
        const offset = this.signExtend16(decoded.immediate);
        if (rsVal > 0) {
          nextPC = this.PC + 4 + (offset << 2);
          branchTaken = true;
        }
        break;
      }
      case 'blez': {
        const rsVal = this.registers[this.parseRegister(args[0])] | 0;
        const offset = this.signExtend16(decoded.immediate);
        if (rsVal <= 0) {
          nextPC = this.PC + 4 + (offset << 2);
          branchTaken = true;
        }
        break;
      }
      
      // Jump instructions
      case 'j': {
        const addr26 = decoded.address << 2;
        const upperBits = (this.PC + 4) & 0xf0000000;
        nextPC = upperBits | addr26;
        break;
      }
      case 'jal': {
        const addr26 = decoded.address << 2;
        const upperBits = (this.PC + 4) & 0xf0000000;
        this.registers[31] = (this.PC + 4) >>> 0; // $ra = PC + 4
        nextPC = upperBits | addr26;
        break;
      }
      case 'jr': {
        nextPC = this.registers[this.parseRegister(args[0])];
        break;
      }
      
      // System call
      case 'syscall':
        // For now, treat syscall as halt
        // If $v0 == 10, it's typically exit
        if (this.registers[2] === 10) {
          this.halted = true;
        }
        break;
      
      case 'nop':
        // Do nothing
        break;
      
      default:
        throw new Error(`Unimplemented instruction: ${mnemonic}`);
    }
    
    // Ensure $zero is always 0
    this.registers[0] = 0;
    
    // Update PC
    this.PC = nextPC;
    this.cycle++;
    this.instructionCount++;
    
    return {
      instruction,
      decoded,
      control,
      branchTaken,
      nextPC
    };
  }
  
   // Step: execute one instruction
  
  step() {
    if (!this.loaded || this.halted) {
      return { success: false, message: 'Program not loaded or halted' };
    }
    
    // Find current instruction
    const instructionIndex = (this.PC - 0x00400000) >>> 2;
    if (instructionIndex < 0 || instructionIndex >= this.instructions.length) {
      this.halted = true;
      return { success: false, message: 'PC out of bounds', halted: true };
    }
    
    const instruction = this.instructions[instructionIndex];
    const pcBeforeExecution = this.PC; // Capture PC before execution
    const executionResult = this.executeInstruction(instruction, this.PC);
    
    const result = {
      success: true,
      instruction,
      executionResult,
      state: this.getState()
    };
    
    if (this.debugMode) {
      this.logDebug(instruction, executionResult, pcBeforeExecution);
    }
    
    return result;
  }
  
   // Run: execute until halt or error
  
  run() {
    if (!this.loaded || this.halted) {
      return { success: false, message: 'Program not loaded or halted' };
    }
    
    const maxSteps = 10000; // Safety limit
    let steps = 0;
    
    while (!this.halted && steps < maxSteps) {
      const result = this.step();
      if (!result.success) {
        return result;
      }
      steps++;
    }
    
    if (steps >= maxSteps) {
      return { success: false, message: 'Maximum step limit reached' };
    }
    
    return {
      success: true,
      steps,
      state: this.getState()
    };
  }
  
   // Reset simulator state
  
  reset() {
    this.registers.fill(0);
    this.memory.fill(0);
    this.PC = 0x00400000;
    this.HI = 0;
    this.LO = 0;
    this.halted = false;
    this.cycle = 0;
    this.instructionCount = 0;
    this.debugLog = [];
    this.usedMemoryAddresses.clear();
    
    if (!this.loaded) {
      this.instructions = [];
      this.labels = {};
    }
  }
  
   // Get the range of used memory addresses
  
  getUsedMemoryRange() {
    if (this.usedMemoryAddresses.size === 0) {
      return { min: 0, max: 0, hasData: false };
    }
    
    const addresses = Array.from(this.usedMemoryAddresses).sort((a, b) => a - b);
    const min = addresses[0];
    const max = addresses[addresses.length - 1];
    
    // Round to word boundaries for display
    const minWord = (min >>> 2) << 2; // Round down to word boundary
    const maxWord = ((max + 3) >>> 2) << 2; // Round up to word boundary
    
    return { 
      min: minWord, 
      max: maxWord, 
      addresses: addresses,
      hasData: true 
    };
  }
  
   // Get current simulator state
  
  getState() {
    return {
      registers: Array.from(this.registers),
      memory: Array.from(this.memory),
      PC: this.PC,
      HI: this.HI,
      LO: this.LO,
      cycle: this.cycle,
      instructionCount: this.instructionCount,
      halted: this.halted,
      loaded: this.loaded,
      instructions: this.instructions
    };
  }
  
   // Format binary instruction as string
  
  formatBinary(instruction) {
    if (typeof instruction !== 'number') return 'N/A';
    return instruction.toString(2).padStart(32, '0');
  }
  
   // Format hex instruction as string
  
  formatHex(instruction) {
    if (typeof instruction !== 'number') return 'N/A';
    return '0x' + instruction.toString(16).padStart(8, '0').toUpperCase();
  }
  
   // Format instruction arguments for display
  
  formatInstructionArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null && arg.type === 'offset_reg') {
        return `${arg.offset}(${arg.reg})`;
      }
      return String(arg);
    }).join(', ');
  }

   // Format instruction for display (without comments)
  
  formatInstruction(instruction) {
    // Always format from mnemonic and args to ensure proper formatting
    // This handles memory operands correctly (e.g., 0($sp) instead of [object Object])
    const formattedArgs = this.formatInstructionArgs(instruction.args || []);
    let formatted = `${instruction.mnemonic}${formattedArgs ? ' ' + formattedArgs : ''}`;
    
    // Strip any comments that might have been included
    formatted = formatted.split('#')[0].trim();
    
    return formatted;
  }

   // Log debug information
  
  logDebug(instruction, executionResult, pcBeforeExecution = null) {
    // Use PC before execution if provided, otherwise use current PC (may be after execution)
    const pc = pcBeforeExecution !== null ? pcBeforeExecution : this.PC;
    
    // Format instruction properly (no comments, proper arg formatting)
    const formattedInst = this.formatInstruction(instruction);
    
    // Skip if this is just a comment or label
    if (!formattedInst || formattedInst.startsWith('#')) {
      return;
    }
    
    const logEntry = {
      cycle: this.cycle,
      PC: this.formatHex(pc),
      instruction: formattedInst,
      binary: this.formatBinary(instruction.binary),
      hex: this.formatHex(instruction.binary),
      decoded: executionResult.decoded,
      control: executionResult.control,
      registers: Array.from(this.registers), // Current register state after execution
      HI: this.HI,
      LO: this.LO
    };
    
    this.debugLog.push(logEntry);
  }
  
   // Get debug log
  
  getDebugLog() {
    return this.debugLog;
  }
  
   // Set debug mode
  
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
  
   // Get listing (instructions with binary representation)
  
  getListing() {
    return this.instructions.map(inst => ({
      address: this.formatHex(inst.address),
      binary: this.formatBinary(inst.binary),
      hex: this.formatHex(inst.binary),
      assembly: inst.originalLine || `${inst.mnemonic} ${inst.args.join(', ')}`
    }));
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MIPSSimulator;
}

