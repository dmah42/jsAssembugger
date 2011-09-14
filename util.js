function decToHex(dec, pad) {
  var hex = Number(dec).toString(16);
  pad = (typeof(pad) === 'undefined' || pad === null) ? 2 : pad;
	while (hex.length < pad)
		hex = '0' + hex;
	return hex;
}

function toBCD(dec) {
  var h = decToHex(d);
  var s = h.toString(10);
  return parseInt(s, 10);
}
