Z80 = {
  r_: {
    // 8-bit registers
    a_: 0, b_: 0, c_: 0, d_: 0, e_: 0, h_: 0, l_: 0, f_: 0,
    // 16-bit registers
    pc_: 0, sp_: 0
  },

  initialize: function() {
    Z80.r_.a_ = Z80.r_.b_ = Z80.r_.c_ = Z80.r_.d_ = Z80.r_.e_ = Z80.r_.h_ = Z80.r_.l_ = Z80.r_.f_ = 0;
    Z80.r_.pc_ = Z80.r_.sp_ = 0;
  },
  
  build_register_table: function(registers) {
  },

  // TODO: Functions into execute members.
  // TODO: Track size of instructions so relative branchs work.
  op_code_map_: {
    // Add E to A, leaving result in A (ADD A, E)
    'ADDr_e': function() {
      Z80.r_.a_ += Z80.r_.e_;                   // Perform addition
      Z80.r_.f_ = 0;                            // Clear flags
      if(!(Z80.r_.a_ & 255)) Z80.r_.f_ |= 0x80; // Check for zero
      if(Z80.r_.a_ > 255) Z80.r_.f_ |= 0x10;    // Check for carry
      Z80.r_.a_ &= 255;                         // Mask to 8-bits
      return 1;
    },
  
    // Compare B to A, setting flags (CP A, B)
    'CPr_b': function() {
      var i = Z80.r_.a_;                        // Temp copy of A
      i -= Z80.r_.b_;                           // Subtract B
      Z80.r_.f_ |= 0x40;                        // Set subtraction flag
      if(!(i & 255)) Z80.r_.f_ |= 0x80;         // Check for zero
      if(i < 0) Z80.r_.f_ |= 0x10;              // Check for underflow
      return 1;
    },
  
    // No-operation (NOP)
    'NOP': function() {
      return 1;
    },
    
    // Push registers B and C to the stack (PUSH BC)
    'PUSHBC': function() {
      Z80.r_.sp_--;                             // Drop through the stack
      Memory.writeByte(Z80.r_.sp_, Z80.r_.b_);  // Write B
	    Z80.r_.sp--;                              // Drop through the stack
  	  Memory.writeByte(Z80.r_.sp_, Z80.r_.c_);  // Write C
	    return 3;
    },

    // Pop registers H and L off the stack (POP HL)
    'POPHL': function() {
      Z80.r_.l_ = Memory.readByte(Z80.r_.sp_);  // Read L
	    Z80.r_.sp_++;                             // Move back up the stack
	    Z80.r_.h_ = Memory.readByte(Z80.r_.sp_);  // Read H
	    Z80.r_.sp++;                              // Move back up the stack
      return 3;
    },

    // Read a byte from absolute location into A (LD A, addr)
    'LDAmm': function() {
      var addr = Memory.readWord(Z80.r_.pc_);   // Get address from instr
	    Z80.r_.pc_ += 2;                          // Advance PC
	    Z80.r_.a_ = Memory.readByte(addr);         // Read from address
	    return 4;
    }
  }
};