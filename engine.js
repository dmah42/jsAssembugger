Engine = {
  asm_: {
    '6502': Asm6502
  },
  current_asm_: null,

  labels_: {},
  code_: null,
  
  register_view_: null,
  
  current_line_: -1,
  timeout_: null,
  
  initialize: function(current_asm, register_view) {
    Engine.code_ = null;
    Engine.labels_.length = 0;
    Engine.register_view_ = register_view;
    Engine.current_asm_ = Engine.asm_[current_asm];
    Engine.current_asm_.initialize();
    Engine.current_asm_.updateRegisterView(Engine.register_view_);
    Engine.current_line_ = 0;
  },
  
  reset: function() {
    Engine.timeout_ = null;
    Engine.current_line_ = -1;
    register_view_ = null;
    code_ = null;
    labels = {};
    current_asm_ = null;
  },

  setReturnHere: function() {
    Engine.labels['return'] = Engine.current_line_;
  },
  
  jumpToLabel: function(label) {
    Engine.current_line_ = Engine.labels[label] + 1;
  },

  runToStart: function(code) {
    Engine.code_ = code;
    for (var i = 0; i < Engine.code_.length; ++i) {
      if (Engine.code_[i].match('^.') === '.')
        Engine.labels_[Engine.code_[i].substr(1)] = i;
    }

    // Check for 'start' label.
    Engine.current_line_ = 0;
    if (Engine.labels_.start !== undefined)
      Engine.jumpToLabel(Engine.labels_.start);
  },
  
  run: function() {
    var time_taken = Engine.step();
    if (time_taken === -1) {
      window.clearTimeout(Engine.timeout_);
      Engine.reset();
    } else {
      Engine.timeout_ = window.setTimeout(Engine.run, time_taken);
    }
  },
  
  pause: function() {
    window.clearTimeout(Engine.timeout_);
  },
  
  step: function() {
    var line = Engine.code_[Engine.current_line_];
    
    var instruction = line.split(' ')[0];
    console.debug('Executing ' + line);

    var op = Engine.current_asm_.instruction_map_[instruction];
    if (op === undefined || op === null) {
      console.error('unknown instruction \'' + instruction + '\'');
      return -1;
    }
        
    try {
      var time_taken = op(line.split(' ')[1]);
      Engine.current_asm_.updateRegisterView(Engine.register_view_);

      // Queue up the next instruction
      // TODO: skip comments, blank lines and branch labels.
      ++Engine.current_line_;
          
      if (Engine.code_[Engine.current_line_] === undefined) {
        console.log('COMPLETE');
        return -1;
      }

      return time_taken;
    } catch (e) {
      if (e.stack)
        console.error(e.stack);
      else if (e.message)
        console.error(e.message);
      else
        console.error(e);
    }
  }
};
