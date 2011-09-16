function decToHex(dec, pad) {
  var hex = Number(dec).toString(16);
  pad = (typeof(pad) === 'undefined' || pad === null) ? 2 : pad;
	while (hex.length < pad)
		hex = '0' + hex;
	return hex;
}

function toBCD(dec) {
  var h = decToHex(dec);
  var s = h.toString(10);
  return parseInt(s, 10);
}

function byteToRgb(byte) {
  var h = (byte * 6) / 255;
  var s = 0.5;
  var v = 1;

  var i = Math.floor(h);
  var f = h - i;

  var p = v * (1 - s);
  var q = v * (1 - s * f);
  var t = v * (1 - s * (1 - f));

  switch(i) {
    case 0:
      return { r: v, g: t, b: p};
    case 1:
      return { r: q, g: v, b: p};
    case 2:
      return { r: p, g: v, b: t};
    case 3:
      return { r: p, g: q, b: v};
    case 4:
      return { r: t, g: p, b: v};
    case 5:
      return { r: v, g: p, b: q};
    default:
      throw new Error('Unexpected byte.');
  }
}
