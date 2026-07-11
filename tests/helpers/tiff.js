// Hand-rolled TIFF/EXIF fixture builder for tests (and the e2e fixture
// script). Layout: header(8) | IFD0 | GPS IFD | Exif IFD | data area.
// opts: { lat: [d,m,s], latRef, lng: [d,m,s], lngRef, heading: number,
//         dateTime: "YYYY:MM:DD HH:MM:SS", littleEndian (default true) }
export function buildTiff(opts = {}) {
  const le = opts.littleEndian !== false;
  const u16 = (v) => (le ? [v & 255, (v >> 8) & 255] : [(v >> 8) & 255, v & 255]);
  const u32 = (v) =>
    le ? [...u16(v & 0xffff), ...u16(v >>> 16)] : [...u16(v >>> 16), ...u16(v & 0xffff)];
  const rational = (v, den = 10000) => [...u32(Math.round(v * den)), ...u32(den)];
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0)).concat([0]);

  // Entry spec: [tag, type, count, inline4Bytes | null, outOfLineBytes | null]
  const gps = [];
  if (opts.lat != null) {
    gps.push([0x0001, 2, 2, ascii(opts.latRef || "N").concat([0, 0]).slice(0, 4), null]);
    gps.push([0x0002, 5, 3, null, opts.lat.flatMap((v) => rational(v))]);
    gps.push([0x0003, 2, 2, ascii(opts.lngRef || "E").concat([0, 0]).slice(0, 4), null]);
    gps.push([0x0004, 5, 3, null, opts.lng.flatMap((v) => rational(v))]);
  }
  if (opts.heading != null) gps.push([0x0011, 5, 1, null, rational(opts.heading)]);
  const exif = [];
  if (opts.dateTime != null) exif.push([0x9003, 2, 20, null, ascii(opts.dateTime)]);

  const ifdSize = (n) => 2 + n * 12 + 4;
  const ifd0N = (gps.length ? 1 : 0) + (exif.length ? 1 : 0);
  const gpsOff = 8 + ifdSize(ifd0N);
  const exifOff = gpsOff + (gps.length ? ifdSize(gps.length) : 0);
  let dataOff = exifOff + (exif.length ? ifdSize(exif.length) : 0);
  const ifd0 = [];
  if (gps.length) ifd0.push([0x8825, 4, 1, u32(gpsOff), null]);
  if (exif.length) ifd0.push([0x8769, 4, 1, u32(exifOff), null]);

  const out = [];
  const data = [];
  const writeIfd = (entries) => {
    out.push(...u16(entries.length));
    for (const [tag, type, count, inline, payload] of entries) {
      out.push(...u16(tag), ...u16(type), ...u32(count));
      if (inline) out.push(...inline);
      else {
        out.push(...u32(dataOff));
        data.push(...payload);
        dataOff += payload.length;
      }
    }
    out.push(...u32(0)); // next-IFD pointer: none
  };
  out.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  writeIfd(ifd0);
  if (gps.length) writeIfd(gps);
  if (exif.length) writeIfd(exif);
  out.push(...data);
  return new Uint8Array(out);
}
