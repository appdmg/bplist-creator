'use strict';

// Adapted from:
// http://code.google.com/p/plist/source/browse/trunk/src/main/java/com/dd/plist/BinaryPropertyListWriter.java

class BufferWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }

  size() {
    return this.length;
  }

  write(value) {
    const chunk = typeof value === 'number'
      ? Buffer.from([value])
      : Buffer.from(value);

    this.chunks.push(chunk);
    this.length += chunk.length;
  }

  getContents() {
    return Buffer.concat(this.chunks, this.length);
  }
}

class Real {
  constructor(value) {
    this.value = value;
  }
}

function createBinaryPlist(dicts) {
  const buffer = new BufferWriter();
  buffer.write(Buffer.from('bplist00', 'ascii'));

  if (Array.isArray(dicts) && dicts.length === 1) {
    dicts = dicts[0];
  }

  let entries = toEntries(dicts);
  const idSizeInBytes = computeIdSizeInBytes(entries.length);
  const offsets = [];
  let offsetSizeInBytes;
  let offsetTableOffset;

  updateEntryIds();

  entries.forEach((entry, entryIdx) => {
    offsets[entryIdx] = buffer.size();
    if (!entry) {
      buffer.write(0x00);
    } else {
      write(entry);
    }
  });

  writeOffsetTable();
  writeTrailer();

  return buffer.getContents();

  function updateEntryIds() {
    const strings = {};
    let entryId = 0;

    entries.forEach((entry) => {
      if (entry.id) {
        return;
      }

      if (entry.type === 'string') {
        if (!entry.bplistOverride && Object.prototype.hasOwnProperty.call(strings, entry.value)) {
          entry.type = 'stringref';
          entry.id = strings[entry.value];
        } else {
          strings[entry.value] = entry.id = entryId++;
        }
      } else {
        entry.id = entryId++;
      }
    });

    entries = entries.filter((entry) => entry.type !== 'stringref');
  }

  function writeTrailer() {
    buffer.write(Buffer.from([0, 0, 0, 0, 0, 0]));
    writeByte(offsetSizeInBytes);
    writeByte(idSizeInBytes);
    writeLong(entries.length);
    writeLong(0);
    writeLong(offsetTableOffset);
  }

  function writeOffsetTable() {
    offsetTableOffset = buffer.size();
    offsetSizeInBytes = computeOffsetSizeInBytes(offsetTableOffset);

    offsets.forEach((offset) => {
      writeBytes(offset, offsetSizeInBytes);
    });
  }

  function write(entry) {
    switch (entry.type) {
      case 'dict':
        writeDict(entry);
        break;
      case 'number':
      case 'double':
        writeNumber(entry);
        break;
      case 'UID':
        writeUID(entry);
        break;
      case 'array':
        writeArray(entry);
        break;
      case 'boolean':
        writeBoolean(entry);
        break;
      case 'string':
      case 'string-utf16':
        writeString(entry);
        break;
      case 'date':
        writeDate(entry);
        break;
      case 'data':
        writeData(entry);
        break;
      default:
        throw new Error('unhandled entry type: ' + entry.type);
    }
  }

  function writeDate(entry) {
    writeByte(0x33);
    writeDouble((Date.parse(entry.value) / 1000) - 978307200);
  }

  function writeDict(entry) {
    writeIntHeader(0xD, entry.entryKeys.length);
    entry.entryKeys.forEach((entryKey) => {
      writeID(entryKey.id);
    });
    entry.entryValues.forEach((entryValue) => {
      writeID(entryValue.id);
    });
  }

  function writeNumber(entry) {
    if (typeof entry.value === 'bigint') {
      writeByte(0x14);
      writeBigInt(entry.value, 16);
    } else if (entry.type !== 'double' && parseFloat(entry.value).toFixed() == entry.value) {
      if (entry.value < 0) {
        writeByte(0x13);
        writeBytes(entry.value, 8, true);
      } else if (entry.value <= 0xff) {
        writeByte(0x10);
        writeBytes(entry.value, 1);
      } else if (entry.value <= 0xffff) {
        writeByte(0x11);
        writeBytes(entry.value, 2);
      } else if (entry.value <= 0xffffffff) {
        writeByte(0x12);
        writeBytes(entry.value, 4);
      } else {
        writeByte(0x13);
        writeBytes(entry.value, 8);
      }
    } else {
      writeByte(0x23);
      writeDouble(entry.value);
    }
  }

  function writeUID(entry) {
    writeIntHeader(0x8, 0x0);
    writeID(entry.value);
  }

  function writeArray(entry) {
    writeIntHeader(0xA, entry.entries.length);
    entry.entries.forEach((entry) => {
      writeID(entry.id);
    });
  }

  function writeBoolean(entry) {
    writeByte(entry.value ? 0x09 : 0x08);
  }

  function writeString(entry) {
    if (entry.type === 'string-utf16' || mustBeUtf16(entry.value)) {
      const utf16 = Buffer.from(entry.value, 'ucs2');
      writeIntHeader(0x6, utf16.length / 2);

      for (let i = 0; i < utf16.length; i += 2) {
        const t = utf16[i + 0];
        utf16[i + 0] = utf16[i + 1];
        utf16[i + 1] = t;
      }

      buffer.write(utf16);
    } else {
      const ascii = Buffer.from(entry.value, 'ascii');
      writeIntHeader(0x5, ascii.length);
      buffer.write(ascii);
    }
  }

  function writeData(entry) {
    writeIntHeader(0x4, entry.value.length);
    buffer.write(entry.value);
  }

  function writeLong(value) {
    writeBytes(value, 8);
  }

  function writeByte(value) {
    buffer.write(Buffer.from([value]));
  }

  function writeDouble(value) {
    const doubleBuffer = Buffer.alloc(8);
    doubleBuffer.writeDoubleBE(value, 0);
    buffer.write(doubleBuffer);
  }

  function writeIntHeader(kind, value) {
    if (value < 15) {
      writeByte((kind << 4) + value);
    } else if (value < 256) {
      writeByte((kind << 4) + 15);
      writeByte(0x10);
      writeBytes(value, 1);
    } else if (value < 65536) {
      writeByte((kind << 4) + 15);
      writeByte(0x11);
      writeBytes(value, 2);
    } else {
      writeByte((kind << 4) + 15);
      writeByte(0x12);
      writeBytes(value, 4);
    }
  }

  function writeID(id) {
    writeBytes(id, idSizeInBytes);
  }

  function writeBytes(value, byteCount, isSignedInt) {
    let bigintValue = BigInt(value);
    const max = 1n << BigInt(byteCount * 8);

    if (isSignedInt && bigintValue < 0) {
      bigintValue = max + bigintValue;
    }

    if (bigintValue < 0 || bigintValue >= max) {
      throw new RangeError('integer value does not fit in ' + byteCount + ' bytes');
    }

    writeBigInt(bigintValue, byteCount);
  }

  function writeBigInt(value, byteCount) {
    const bytes = Buffer.alloc(byteCount);
    const max = 1n << BigInt(byteCount * 8);
    let remaining = value < 0 ? max + value : value;

    if (remaining < 0 || remaining >= max) {
      throw new RangeError('integer value does not fit in ' + byteCount + ' bytes');
    }

    for (let i = byteCount - 1; i >= 0; i--) {
      bytes[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }

    buffer.write(bytes);
  }

  function mustBeUtf16(string) {
    return Buffer.byteLength(string, 'utf8') !== string.length;
  }
}

function toEntries(dicts) {
  if (dicts.bplistOverride) {
    return [dicts];
  }

  if (Array.isArray(dicts)) {
    return toEntriesArray(dicts);
  }

  if (Buffer.isBuffer(dicts)) {
    return [{ type: 'data', value: dicts }];
  }

  if (dicts instanceof Real) {
    return [{ type: 'double', value: dicts.value }];
  }

  if (dicts instanceof Date) {
    return [{ type: 'date', value: dicts }];
  }

  if (typeof dicts === 'object' && dicts !== null) {
    if (Object.keys(dicts).length === 1 && typeof dicts.UID === 'number') {
      return [{ type: 'UID', value: dicts.UID }];
    }

    return toEntriesObject(dicts);
  }

  if (typeof dicts === 'string') {
    return [{ type: 'string', value: dicts }];
  }

  if (typeof dicts === 'number') {
    return [{ type: 'number', value: dicts }];
  }

  if (typeof dicts === 'boolean') {
    return [{ type: 'boolean', value: dicts }];
  }

  if (typeof dicts === 'bigint') {
    return [{ type: 'number', value: dicts }];
  }

  throw new Error('unhandled entry: ' + dicts);
}

function toEntriesArray(arr) {
  let results = [{ type: 'array', entries: [] }];

  arr.forEach((value) => {
    const entry = toEntries(value);
    results[0].entries.push(entry[0]);
    results = results.concat(entry);
  });

  return results;
}

function toEntriesObject(dict) {
  let results = [{ type: 'dict', entryKeys: [], entryValues: [] }];

  Object.keys(dict).forEach((key) => {
    const entryKey = toEntries(key);
    results[0].entryKeys.push(entryKey[0]);
    results = results.concat(entryKey[0]);
  });

  Object.keys(dict).forEach((key) => {
    const entryValue = toEntries(dict[key]);
    results[0].entryValues.push(entryValue[0]);
    results = results.concat(entryValue);
  });

  return results;
}

function computeOffsetSizeInBytes(maxOffset) {
  if (maxOffset < 256) {
    return 1;
  }
  if (maxOffset < 65536) {
    return 2;
  }
  if (maxOffset < 4294967296) {
    return 4;
  }
  return 8;
}

function computeIdSizeInBytes(numberOfIds) {
  if (numberOfIds < 256) {
    return 1;
  }
  if (numberOfIds < 65536) {
    return 2;
  }
  return 4;
}

module.exports = createBinaryPlist;
module.exports.Real = Real;
