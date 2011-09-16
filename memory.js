// TODO: separate out video view and text view.
// TODO: LE or BE.
Memory = {
	width_: 64,
	height_: 64,
	memory_: [],
  
  textData_: [],
  
  context_: null,
  
  initialize: function(text, video) {
    Memory.memory_.length = this.width_ * this.height_ * 4;
	  for (i = 0; i < Memory.memory_.length; ++i)
		  Memory.memory_[i] = 0x00;
	
	  // Set up text view.
	  Memory.textData_.length = this.memory_.length;
	  text.innerHTML = '';
	
    // TODO: header row/column.
    var index = 0;
	  for (i = 0; i < Memory.height_; ++i) {
		  var row = document.createElement('div');
		  for (j = 0; j < Memory.width_ * 4; ++j, ++index) {
			  var span = document.createElement('span');
			  span.innerText = '0x' + decToHex(Memory.memory_[index]);
			  Memory.textData_[index] = span;
			  row.appendChild(span);
			  row.appendChild(document.createTextNode(' '));
		  }
		  text.appendChild(row);
	  }
	
	  // Clear video view to black.
	  video.width = Memory.width_ * 4;
	  video.height = Memory.height_ * 4;
	
	  Memory.context_ = (video && video.getContext) ? video.getContext('2d') : null;
	  if (Memory.context_) {
		  Memory.context_.fillStyle = '#000';
		  Memory.context_.fillRect(0, 0, video.width, video.height);
	  }
  },
  
  writeByte: function(address, byte) {
    if (address < 0 || address > Memory.memory_.length)
      throw new Error('Address out of range.');
    
    if (byte < 0 || byte > 0xFF)
      throw new Error('Value out of range.');
    
    Memory.memory_[address] = byte;
    
    var video_address_x = (address % (Memory.width_ * 4));
    var video_address_y = Math.floor(address / (Memory.width_ * 4));
    
    var imageData = Memory.context_.getImageData(video_address_x, video_address_y, 1, 1);
    // Cache the data array reference to avoid DOM access.
    var data = imageData.data;
    var color = byteToRgb(byte);
    data[0] = (color.r * 0xFF) & 0xFF;
    data[1] = (color.b * 0xFF) & 0xFF;
    data[2] = (color.g * 0xFF) & 0xFF;
    data[3] = 0xFF;
    Memory.context_.putImageData(imageData, video_address_x, video_address_y);
	
    // Set text value and the color to red and fade to black over a few frames.
    var span = Memory.textData_[address];
    span.innerText = '0x' + decToHex(byte);	
    span.redness = 0xFF;
    span.animInterval = window.setInterval(
      function() {
        var redness = span.redness;
        redness -= 2;
        if (redness < 0) {
          redness = 0;
          window.clearInterval(span.animInterval);
        }
      
        span.style.color = 'rgb(' + redness + ', 0, 0)';
        span.redness = redness;
      }, 16);
  },
  
  writeWord: function(address, word) {
    if (word < 0 || word > 0xFFFF)
      throw new Error('Value out of range.');
 
    Memory.writeByte(address, word >> 8);
    Memory.writeByte(address + 1, word & 0xFF);
  },

  writeDword: function(address, dword) {
	  if (dword < 0 || dword > 0xFFFFFFFF)
      throw new Error('Value out of range.');
	
	  Memory.writeWord(address, dword >> 16);
	  Memory.writeWord(address + 2, dword & 0xFFFF);
  },
  
  readByte: function(address) {
    if (address < 0 || address > Memory.memory_.length)
      throw new Error('Address out of range.');

    return Memory.memory_[address];
  },
  
  readWord: function(address) {
    var upper_byte = Memory.readByte(address);
    var lower_byte = Memory.readByte(address + 1);
  
    return (upper_byte << 8) | lower_byte;
  },

  readDword: function(address) {
	  var upper_word = Memory.readWord(address);
	  var lower_word = Memory.readWord(address + 2);
	
	  return (upper_word << 16) | lower_word;
  }
};