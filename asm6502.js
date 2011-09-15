Asm6502 = {
  r_: {
    A: 0,       // 8-bit accumulator
    X: 0, Y: 0, // 8-bit index
    P: 0,       // 8-bit status
    S: 0,       // 8-bit stack hard-wired from 0x0100 to 0x01FF
    PC: 0       // 16-bit program counter
  },
  
  AddressingMode: {
    ACCUMULATOR: 0,
    IMMEDIATE: 1,
    ZERO_PAGE: 2,
    ZERO_PAGE_INDEX: 3,
    ABSOLUTE: 4,
    ABSOLUTE_INDEX: 5,
    INDIRECT: 6,
    INDIRECT_X: 7,
    INDIRECT_Y: 8
  },
  
  initialize: function() {
    Asm6502.r_.A = 0;
    Asm6502.r_.X = Asm6502.r_.Y = 0;
    Asm6502.r_.P = 0;
    Asm6502.r_.S = 0;
    Asm6502.r_.PC = 0;
  },
  
  updateRegisterView: function(register_view) {
    var table = document.getElementById('register_table');
    if (table === null) {
      table = document.createElement('table');
      table.id = 'register_table';
      register_view.appendChild(table);
      
      for (var r in Asm6502.r_) {
        var row = document.createElement('tr');
        var key_cell = document.createElement('td');
        key_cell.innerHTML = r;
        var value_cell = document.createElement('td');
        value_cell.id = r + '.value';
        row.appendChild(key_cell);
        row.appendChild(value_cell);
        table.appendChild(row);
      }
    }
    
    // TODO: switch between hex and dec
    for (var reg in Asm6502.r_) {
      var cell = document.getElementById(reg + '.value');
      cell.innerHTML = '0x' + (reg === 'S' ? '01' : '') + decToHex(Asm6502.r_[reg], 2);
    }
  },

  Flags: {
    CARRY: 0,
    ZERO: 1,
    INTERRUPT: 2,
    DECIMAL: 3,
    BREAK: 4,
    OVERFLOW: 6,
    NEGATIVE: 7
  },

  setFlag: function(f, b) {
		if (b)
      Asm6502.r_.P |= 1 << Asm6502.Flags[f];
    else
      Asm6502.r_.P &= ~(1 << Asm6502.Flags[f]);
  },
  
  getFlag: function(f) {
    return Asm6502.r_.P & (1 << Asm6502.Flags[f]);
  },

  // TODO: page crossing cycle counts.
  getAddressingMode: function(operands) {
    // accumulator
    if (operands == 'A') {
      return { mode: Asm6502.AddressingMode.ACCUMULATOR,
               value: Asm6502.r_.A,
               cycles: 0 };
    }

    // immediate
    var match = operands.match(/^#([0-9A-Z]{2})$/);
    if (match !== null) {
      return { mode: Asm6502.AddressingMode.IMMEDIATE,
               value: parseInt(RegExp.$1, 16),
               cycles: 2 };
    }

    // absolute or zero page
    match = operands.match(/^\$([0-9]{1,4})$/);
    if (match !== null) {
      return { mode: (RegExp.$1.length <= 2) ? Asm6502.AddressingMode.ZERO_PAGE : Asm6502.AddressingMode.ABSOLUTE,
               address: parseInt(RegExp.$1, 16),
               cycles: RegExp.$1.length <= 2 ? 3 : 4 };
    }

    // absolute,X, absolute,Y, or zero page,X
    match = operands.match(/^\$([0-9]{1,4}),\s*(X|Y)$/);
    if (match !== null) {
      return { mode: (RegExp.$1.length <= 2) ? Asm6502.AddressingMode.ZERO_PAGE_INDEX : Asm6502.AddressingMode.ABSOLUTE_INDEX,
               address: parseInt(RegExp.$1, 16) + Asm6502.r_[RegExp.$2],
               cycles: 6 };
    }
    
    match = operands.match(/^\(\$([0-9]{1,4})\)$/);
    if (match !== null) {
      return { mode: Asm6502.AddressingMode.INDIRECT,
               address: parseInt(RegExp.$1, 16),
               cycles: 5 };
    }
    
    // (indirect,X)
    match = operands.match(/^\(\$([0-9]{1,4}),\s*X\)$/);
    if (match !== null) {
      return { mode: Asm6502.AddressingMode.INDIRECT_X,
               address: parseInt(RegExp.$1, 16) + Asm6502.r_.X,
               cycles: 6 };
    }
    
    // (indirect),Y
    match = operands.match(/^\(\$([0-9]{1,4})\),\s*Y\)$/);
    if (match !== null) {
      return { mode: INDIRECT_Y,
               address: Memory.readWord(parseInt(RegExp.$1, 16)) + Asm6502.r_.Y,
               cycles: 5 };
    }
    
    throw 'Unable to parse addressing mode from \'' + operands + '\'';
  },

  // TODO: Track size of instructions so relative branchs work.
  // TODO: Pass allowed addressing modes to getAddressingMode to minimize regexpv
  instruction_map_: {
    // MEMORY INSTRUCTIONS
    // Load Accumulator
    'LDA': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      Asm6502.r_.A = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;
    },
    
    // Load X
    'LDX': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      // TODO: check for ZERO_PAGE_INDEX_X
      if (addr_mode === Asm6502.AddressingMode.INDEX_X || addr_mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      Asm6502.r_.X = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;
    },
    
    // Load Y
    'LDY': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      // TODO: check for ZERO_PAGE_INDEX_X
      if (addr_mode === Asm6502.AddressingMode.INDEX_X || addr_mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      Asm6502.r_.Y = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;
    },
    
    // Store accumulator.
    'STA': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode === Asm6502.AddressingMode.IMMEDIATE)
        throw 'Invalid addressing mode';

      Memory.writeByte(addr_mode.address, Asm6502.r_.A);
      return addr_mode.cycles;
    },
    
    // Store X
    'STX': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE &&
          addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE_INDEX &&
          addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE) {
        throw 'Invalid addressing mode';
      }

      Memory.writeByte(addr_mode.address, Asm6502.r_.X);
      return addr_mode.cycles;
    },
    
    // Store Y
    'STY': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE &&
          addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE_INDEX &&
          addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE) {
        throw 'Invalid addressing mode';
      }

      Memory.writeByte(addr_mode.address, Asm6502.r_.Y);
      return addr_mode.cycles;
    },
    
    // REGISTER INSTRUCTIONS
    // Transfer accumulator to X
    'TAX': function(operands) {
      Asm6502.r_.X = Asm6502.r_.A;
      SetFlag(Asm6502.Flags.ZERO, Asm6502.r_.X === 0);
      SetFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.X >> 7) === 1);
      return 2;
    },
    
    // Transfer accumulator to Y
    'TAY': function(operands) {
      Asm6502.r_.Y = Asm6502.r_.A;
      SetFlag(Asm6502.Flags.ZERO, Asm6502.r_.Y === 0);
      SetFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.Y >> 7) === 1);
      return 2;
    },
    
    // Transfer X to accumulator
    'TXA': function(operands) {
      Asm6502.r_.A = Asm6502.r_.X;
      SetFlag(Asm6502.Flags.ZERO, Asm6502.r_.A === 0);
      SetFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.A >> 7) === 1);
      return 2;
    },
    
    // Transfer Y to accumulator
    'TYA': function(operands) {
      Asm6502.r_.A = Asm6502.r_.Y;
      SetFlag(Asm6502.Flags.ZERO, Asm6502.r_.A === 0);
      SetFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.A >> 7) === 1);
      return 2;
    },
    
    // Transfer stack pointer to X
    'TSX': function(operands) {
      Asm6502.r_.X = Asm6502.r_.S;
      SetFlag(Asm6502.Flags.ZERO, Asm6502.r_.X === 0);
      SetFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.X >> 7) === 1);
      return 2;
    },
    
    // Transfer X to stack pointer
    'TXS': function(operands) {
      Asm6502.r_.S = Asm6502.r_.X;
      return 2;
    },
    
    // STACK INSTRUCTIONS
    // Push accumulator
    'PHA': function(operands) {
      Memory.writeByte(0x0100 + Asm6502.r_.S, Asm6502.r_.A);
      ++Asm6502.r_.S;
      return 3;
    },

    // Push status register
    'PHP': function(operands) {
      Memory.writeByte(0x0100 + Asm6502.r_.S, Asm6502.r_.P);
      ++Asm6502.r_.S;
      return 3;
    },

    // Pull accumulator
    'PLA': function(operands) {
      --Asm6502.r_.S;
      Asm6502.r_.A = Memory.readByte(0x0100 + Asm6502.r_.S);
      Asm6502.setFlag(Asm6502.Flags.ZERO, Asm6502.r_.A === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (Asm6502.r_.A >> 7) === 1);
      return 4;
    },
    
    // Pull status register
    'PLP': function(operands) {
      --Asm6502.r_.S;
      Asm6502.r_.P = Memory.readByte(0x0100 + Asm6502.r_.S);
      return 4;
    },
    
    // LOGICAL INSTRUCTIONS
    // Logical AND with accumulator
    'AND': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      value = Asm6502.r_.A && value;
      Asm6502.r_.A = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;      
    },
    
    // EOR
    'EOR': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      value = Asm6502.r_.A ? !value : value;
      Asm6502.r_.A = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;
    },
    
    // ORA
    'ORA': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      value = Asm6502.r_.A || value;
      Asm6502.r_.A = value;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles;
    },
    
    
    // ARITHMETIC INSTRUCTIONS
    // Add with carry
    'ADC': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A + value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
      Asm6502.setFlag(Asm6502.Flags.OVERFLOW, (Asm6502.r_.A ^ value) & 0x80);
        
      Asm6502.r_.A = (result & 0xFF);
    },
    
    // Decrement with carry
    'DEC': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      // TODO: check for ZERO_PAGE_INDEX_X
      if (addr_mode.mode === Asm6502.AddressingMode.IMMEDIATE ||
          addr_mode.mode === Asm6502.AddressingMode.INDEX_X ||
          addr_mode.mode === Asm6502.AddressingMode.INDEX_Y) {
        throw 'Invalid addressing mode';
      }

      var value = Memory.readByte(addr_mode.address) - 1;
      Memory.writeByte(addr_mode.address, value);
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles + 2;
    },
    
    // Decrement X
    'DEX': function(operands) {
      var value = Asm6502.r_.X - 1;
      Asm6502.r_.X = value & 0xFF;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return 2;
    },
    
    // Decrement Y
    'DEY': function(operands) {
      var value = Asm6502.r_.Y - 1;
      Asm6502.r_.Y = value & 0xFF;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return 2;
    },
    
    // Increment
    'INC': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      // TODO: check for ZERO_PAGE_INDEX_X
      if (addr_mode.mode === Asm6502.AddressingMode.IMMEDIATE ||
          addr_mode.mode === Asm6502.AddressingMode.INDEX_X ||
          addr_mode.mode === Asm6502.AddressingMode.INDEX_Y) {
        throw 'Invalid addressing mode';
      }

      var value = Memory.readByte(addr_mode.address) + 1;
      Memory.writeByte(addr_mode.address, value);
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return addr_mode.cycles + 1;
    },
    
    // Increment X
    'INX': function(operands) {
      var value = Asm6502.r_.X + 1;
      Asm6502.r_.X = value & 0xFF;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return 2;
    },
    
    // Increment Y
    'INY': function(operands) {
      var value = Asm6502.r_.Y + 1;
      Asm6502.r_.Y = value & 0xFF;
      Asm6502.setFlag(Asm6502.Flags.ZERO, value === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (value >> 7) === 1);
      return 2;
    },
    
    // Subtract with carry
    'SBC': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A - value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
      Asm6502.setFlag(Asm6502.Flags.OVERFLOW, (Asm6502.r_.A ^ value) & 0x80);
        
      Asm6502.r_.A = (result & 0xFF);
      return addr_mode.cycles;
    },
    
    // BIT MANIPULATION OPERATIONS
    // Arithmetic shift left
    'ASL': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);

      if (addr_mode.mode === Asm6502.AddressingMode.INDEX_X || addr_mode.mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A << value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
        
      Asm6502.r_.A = (result & 0xFF);
      return addr_mode.cycles + 2;
    },
    
    // Logical shift right
    'LSR': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);

      if (addr_mode.mode === Asm6502.AddressingMode.INDEX_X || addr_mode.mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A >> value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.CARRY, (Asm6502.r_.A & 0x1) == 1);

      Asm6502.r_.A = (result & 0xFF);
      return addr_mode.cycles + 2;
    },
    
    // Rotate left
    'ROL': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);

      if (addr_mode.mode === Asm6502.AddressingMode.INDEX_X || addr_mode.mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A << value;
      result |= (Asm6502.r_.A >> 7);
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, (Asm6502.r_.A & 0x1) == 1);

      Asm6502.r_.A = (result & 0xFF);
      return addr_mode.cycles + 2;
    },
    
    // Rotate right
    'ROR': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);

      if (addr_mode.mode === Asm6502.AddressingMode.INDEX_X || addr_mode.mode === Asm6502.AddressingMode.INDEX_Y)
        throw 'Invalid addressing mode';

      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A >> value;
      result |= (Asm6502.r_.A & 0x1) << 7;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, (Asm6502.r_.A & 0x1) == 1);

      Asm6502.r_.A = (result & 0xFF);
      return addr_mode.cycles + 2;
    },
    
    // SUBROUTINE OPERATIONS
    // Jump
    'JMP': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE && addr_mode.mode !== Asm6502.AddressingMode.INDEX)
        throw 'Invalid addressing mode';
      
      var value = (addr_mode.mode === Asm6502.AddressingMode.ABSOLUTE) ? addr_mode.address : Memory.readWord(addr_mode.address);
      Asm6502.r_.PC = value;
      // TODO: jump to address in engine.
      return addr_mode.cycles - 1;
    },
    
    // Jump subroutine
    'JSR': function(operands) {
      Memory.writeWord(0x0100 + Asm6502.r_.S, Asm6502.r_.PC);
      Asm6502.r_.S += 2;
      Memory.writeByte(0x0100 + Asm6502.r_.S, Asm6502.r_.P);
      ++Asm6502.r_.S;

      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE)
        throw 'Invalid addressing mode';

      Asm6502.r_.PC = addr_mode.address;
      // TODO: jump to address in engine.
      return 6;
    },
    
    // Return from interrupt
    'RTI': function(operands) {
      --Asm6502.r_.S;
      Asm6502.r_.P = Memory.readByte(0x0100 + Asm6502.r_.S);
      Asm6502.r_.S -= 2;
      Asm6502.r_.PC = Memory.readWord(0x0100 + Asm6502.r_.S);
      return 6;
    },
    
    // Return from subroutine
    'RTS': function(operands) {
      --Asm6502.r_.S;
      Asm6502.r_.P = Memory.readByte(0x0100 + Asm6502.r_.S);
      Asm6502.r_.S -= 2;
      Asm6502.r_.PC = Memory.readWord(0x0100 + Asm6502.r_.S);
      return 6;
    },
    
    // COMPARISON INSTRUCTIONS
    // Bit test
    'BIT': function(operands) {
      var addr_mode = getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE &&
          addr_mode.mode !== Asm6502.AddressingMode.ZEROPAGE) {
        throw 'Invalid addressing mode';
      }
      
      var value = Memory.readByte(addr_mode.address);
      var result = value & Asm6502.r_.A;
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.OVERFLOW, (result >> 6) === 1);
      
      return addr_mode.cycles;
    },
    
    // Compare with accumulator
    'CMP': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.A - value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
      
      return addr_mode.cycles;
    },
    
    // Compare with X
    'CPX': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.X - value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
      
      return addr_mode.cycles;
    },
    
    // Compare with Y
    'CPY': function(operands) {
      
      var addr_mode = Asm6502.getAddressingMode(operands);
      var value = (addr_mode.mode == Asm6502.AddressingMode.IMMEDIATE) ? (addr_mode.value & 0xFF) : Memory.readByte(addr_mode.address);
      if (getFlag(Asm6502.Flags.DECIMAL))
        value = toBCD(value);
      
      var result = Asm6502.r_.Y - value;
      
      Asm6502.setFlag(Asm6502.Flags.ZERO, result === 0);
      Asm6502.setFlag(Asm6502.Flags.NEGATIVE, (result >> 7) === 1);
      Asm6502.setFlag(Asm6502.Flags.CARRY, result > 0xFF);
      
      return addr_mode.cycles;
    },
    
    // BRANCHING INSTRUCTIONS
    // TODO: displacement by non-label
    // Branch on carry clear
    'BCC': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.CARRY) === 0) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // Branch on carry set
    'BCS': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.CARRY) === 1) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // Branch on equal
    'BEQ': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.ZERO) === 1) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // Branch on minus
    'BMI': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.NEGATIVE) === 1) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // Branch on not equal
    'BNE': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.ZERO) === 0) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // Branch on plus
    'BPL': function(operands) {
      var cycles = 2;
      if (getFlag(Asm6502.Flags.NEGATIVE) === 0) {
        // TODO: cost of page crossing.
        Engine.jumpToLabel(operands);
        ++cycles;
      }
      return cycles;
    },
    
    // STATUS INSTRUCTIONS
    // Break
    'BRK': function(operands) {
      // TODO: interrupt.
      Engine.pause();
      return 1;
    },
    
    // Clear carry
    'CLC': function(operands) {
      setFlag(Asm6502.Flags.CARRY, false);
      return 2;
    },
    
    // Clear decimal
    'CLD': function(operands) {
      setFlag(Asm6502.Flags.DECIMAL, false);
      return 2;
    },
    
    // Clear interrupt
    'CLI': function(operands) {
      setFlag(Asm6502.Flags.INTERRUPT, false);
      return 2;
    },
    
    // Clear overflow
    'CLV': function(operands) {
      setFlag(Asm6502.Flags.OVERFLOW, false);
      return 2;
    },
    
    // NOP
    'NOP': function(operands) {
      return 1;
    },
    
    // Set carry
    'SEC': function(operands) {
      setFlag(Asm6502.Flags.CARRY, true);
      return 2;
    },
    
    // Set decimal
    'SED': function(operands) {
      setFlag(Asm6502.Flags.DECIMAL, true);
      return 2;
    },
    
    // Set interrupt
    'SEI': function(operands) {
      setFlag(Asm6502.Flags.INTERRUPT, true);
      return 2;
    }
  }
};
