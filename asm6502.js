Asm6502 = {
  r_: {
    A: 0,       // 8-bit accumulator
    X: 0, Y: 0, // 8-bit index
    P: 0,       // 8-bit status
    S: 0,       // 8-bit stack hard-wired from 0x0100 to 0x01FF
    PC: 0       // 16-bit program counter
  },
  
  AddressingMode: {
    IMMEDIATE: 0,
    ZERO_PAGE: 1,
    ZERO_PAGE_INDEX: 2,
    ABSOLUTE: 3,
    ABSOLUTE_INDEX: 4,
    INDIRECT_X: 5,
    INDIRECT_Y: 6
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

  // TODO: page crossing cycle counts.
  getAddressingMode: function(operands) {
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
               cycles: 4 };
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
        throw 'Invalid index addressing mode for LDX';

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
        throw 'Invalid index addressing mode for LDX';

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
        throw 'Invalid immediate addressing mode for STA';

      Memory.writeByte(addr_mode.address, Asm6502.r_.A);
      return addr_mode.cycles;
    },
    
    // Store X
    'STX': function(operands) {
      var addr_mode = Asm6502.getAddressingMode(operands);
      if (addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE &&
          addr_mode.mode !== Asm6502.AddressingMode.ZERO_PAGE_INDEX &&
          addr_mode.mode !== Asm6502.AddressingMode.ABSOLUTE) {
        throw 'Invalid addressing mode for STA';
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
        throw 'Invalid addressing mode for STA';
      }

      Memory.writeByte(addr_mode.address, Asm6502.r_.Y);
      return addr_mode.cycles;
    },
    
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
    }
  }
};
