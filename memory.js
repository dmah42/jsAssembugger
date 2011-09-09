// TODO: LE or BE.
function Memory() {
    var memory_ = new Array();
    memory_.length = 256 * 256 * 4;
    
    function write_byte(address, byte) {
        if (address < 0 || address > memory_.length) {
            // TODO: error handling.
            return;
        }
        
        if (byte < 0 || byte > 0xFF) {
            return;
        }
        
        memory_[address] = byte;
    }
    
    function write_word(address, word) {
        if (word < 0 || word > 0xFFFF) {
            return;
        }
     
        write_byte(address, word >> 8);
        write_byte(address + 1, word & 0xFF);
    }
    
    function read_byte(address) {
        if (address < 0 || address > memory_.length) {
            // TODO: error handling.
            return;
        }

        return memory_[address];
    }
    
    function read_word(address) {
        var upper_byte = read_byte(address);
        var lower_byte = read_byte(address + 1);
        
        return (upper_byte << 8) & lower_byte;
    }
}