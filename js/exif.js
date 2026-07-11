// Minimal EXIF reader: enough to pull the GPS position, the compass heading
// (GPSImgDirection — the repo's `heading` definition), and the capture time
// out of a photo in the browser. No dependencies; pure functions over bytes.
// Unit tests: tests/exif.test.js.

const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
const MAX_COUNT = 4096; // sanity cap — no tag we read is remotely this large

// One IFD (directory of 12-byte tag entries) -> Map(tag -> entry).
function readIfd(dv, ifdOffset, le) {
  const entries = new Map();
  const count = dv.getUint16(ifdOffset, le);
  for (let i = 0; i < count; i++) {
    const off = ifdOffset + 2 + i * 12;
    entries.set(dv.getUint16(off, le), {
      type: dv.getUint16(off + 2, le),
      count: dv.getUint32(off + 4, le),
      valueOffset: off + 8, // where the 4 value-or-pointer bytes live
    });
  }
  return entries;
}

// Where an entry's payload starts: inline if it fits the 4 bytes, else pointed-to.
function payloadOffset(dv, entry, le) {
  if (entry.count > MAX_COUNT) throw new Error("EXIF value too large");
  const size = (TYPE_SIZES[entry.type] || 1) * entry.count;
  return size <= 4 ? entry.valueOffset : dv.getUint32(entry.valueOffset, le);
}

function readAscii(dv, entry, le) {
  const off = payloadOffset(dv, entry, le);
  let s = "";
  for (let i = 0; i < entry.count; i++) {
    const c = dv.getUint8(off + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readRationals(dv, entry, le) {
  const off = payloadOffset(dv, entry, le);
  const out = [];
  for (let i = 0; i < entry.count; i++) {
    const num = dv.getUint32(off + i * 8, le);
    const den = dv.getUint32(off + i * 8 + 4, le);
    out.push(den === 0 ? NaN : num / den);
  }
  return out;
}

// [deg, min, sec] -> signed decimal degrees ("S"/"W" hemisphere -> negative).
export function dmsToDeg(dms, ref) {
  const [d = NaN, m = 0, s = 0] = dms || [];
  const deg = d + m / 60 + s / 3600;
  return /^[SW]/i.test(ref || "") ? -deg : deg;
}

// Tag ids (EXIF 2.3).
const IFD0_GPS = 0x8825;
const IFD0_EXIF = 0x8769;
const GPS_LAT_REF = 0x0001, GPS_LAT = 0x0002, GPS_LNG_REF = 0x0003, GPS_LNG = 0x0004;
const GPS_IMG_DIR = 0x0011;
const EXIF_DATETIME_ORIGINAL = 0x9003;

// Parse a TIFF/EXIF block. Returns { lat, lng, heading, date } — each null
// when absent (date: {year, month, day, hour, minute}). Throws on malformed
// input; parseExif() is the catching entry point. Out-of-range offsets throw
// RangeError from DataView, which serves as the bounds check.
export function parseTiff(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = dv.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) throw new Error("not a TIFF block");
  const le = order === 0x4949;
  if (dv.getUint16(2, le) !== 42) throw new Error("bad TIFF magic");
  const ifd0 = readIfd(dv, dv.getUint32(4, le), le);

  const out = { lat: null, lng: null, heading: null, date: null };

  const gpsPtr = ifd0.get(IFD0_GPS);
  if (gpsPtr) {
    const gps = readIfd(dv, dv.getUint32(gpsPtr.valueOffset, le), le);
    const lat = gps.get(GPS_LAT), lng = gps.get(GPS_LNG);
    if (lat && lng) {
      const latRef = gps.has(GPS_LAT_REF) ? readAscii(dv, gps.get(GPS_LAT_REF), le) : "N";
      const lngRef = gps.has(GPS_LNG_REF) ? readAscii(dv, gps.get(GPS_LNG_REF), le) : "E";
      const la = dmsToDeg(readRationals(dv, lat, le), latRef);
      const ln = dmsToDeg(readRationals(dv, lng, le), lngRef);
      if (Number.isFinite(la) && Number.isFinite(ln)) {
        out.lat = la;
        out.lng = ln;
      }
    }
    const dir = gps.get(GPS_IMG_DIR);
    if (dir) {
      const h = readRationals(dv, dir, le)[0];
      if (Number.isFinite(h)) out.heading = h;
    }
  }

  const exifPtr = ifd0.get(IFD0_EXIF);
  if (exifPtr) {
    const exif = readIfd(dv, dv.getUint32(exifPtr.valueOffset, le), le);
    const dt = exif.get(EXIF_DATETIME_ORIGINAL);
    if (dt) {
      const m = readAscii(dv, dt, le).match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/);
      if (m) {
        out.date = { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] };
      }
    }
  }
  return out;
}
