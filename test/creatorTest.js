'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('ava').default;
const bplistParser = require('bplist-parser');
const bplistCreator = require('../');

const fixtureNames = [
  'sample1.bplist',
  'sample2.bplist',
  'binaryData.bplist',
  'airplay.bplist',
  'integers.bplist'
];

for (const fixtureName of fixtureNames) {
  test('creates byte-identical binary plist for ' + fixtureName, async (t) => {
    const file = path.join(__dirname, fixtureName);
    const expected = await fs.readFile(file);
    const dicts = await bplistParser.parseFile(file);

    applyFixtureOverrides(dicts);

    const actual = bplistCreator(dicts);

    t.true(Buffer.isBuffer(actual));
    t.is(Buffer.compare(actual, expected), 0, describeBufferDifference(actual, expected));
  });
}

test('exports Real helper for forced double values', (t) => {
  const buffer = bplistCreator({
    backgroundRed: new bplistCreator.Real(1),
    backgroundGreen: new bplistCreator.Real(0),
    backgroundBlue: new bplistCreator.Real(0)
  });

  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.includes(Buffer.from('bplist00', 'ascii')));
});

function applyFixtureOverrides(dicts) {
  const root = dicts && dicts[0];

  if (!root) {
    return;
  }

  if (root.loadedTimeRanges && root.loadedTimeRanges[0] && Object.prototype.hasOwnProperty.call(root.loadedTimeRanges[0], 'start')) {
    root.loadedTimeRanges[0].start = {
      bplistOverride: true,
      type: 'double',
      value: root.loadedTimeRanges[0].start
    };
  }

  if (root.seekableTimeRanges && root.seekableTimeRanges[0] && Object.prototype.hasOwnProperty.call(root.seekableTimeRanges[0], 'start')) {
    root.seekableTimeRanges[0].start = {
      bplistOverride: true,
      type: 'double',
      value: root.seekableTimeRanges[0].start
    };
  }

  if (Object.prototype.hasOwnProperty.call(root, 'rate')) {
    root.rate = {
      bplistOverride: true,
      type: 'double',
      value: root.rate
    };
  }

  if (Object.prototype.hasOwnProperty.call(root, 'NSHumanReadableCopyright')) {
    root.NSHumanReadableCopyright = {
      bplistOverride: true,
      type: 'string-utf16',
      value: root.NSHumanReadableCopyright
    };
  }

  forceString(root, 'CFBundleExecutable');
  forceString(root, 'CFBundleDisplayName');
  forceString(root, 'DTPlatformBuild');

  if (root.CFBundleURLTypes && root.CFBundleURLTypes[0] && Object.prototype.hasOwnProperty.call(root.CFBundleURLTypes[0], 'CFBundleURLSchemes')) {
    root.CFBundleURLTypes[0].CFBundleURLSchemes[0] = {
      bplistOverride: true,
      type: 'string',
      value: root.CFBundleURLTypes[0].CFBundleURLSchemes[0]
    };
  }

  if (Object.prototype.hasOwnProperty.call(root, 'int64item')) {
    root.int64item = {
      bplistOverride: true,
      type: 'number',
      value: root.int64item.value
    };
  }
}

function forceString(root, key) {
  if (!Object.prototype.hasOwnProperty.call(root, key)) {
    return;
  }

  root[key] = {
    bplistOverride: true,
    type: 'string',
    value: root[key]
  };
}

function describeBufferDifference(actual, expected) {
  if (actual.length !== expected.length) {
    return 'buffer size mismatch. found: ' + actual.length + ', expected: ' + expected.length + '.';
  }

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      return 'buffer mismatch at offset 0x' + i.toString(16) + '. found: 0x' + actual[i].toString(16) + ', expected: 0x' + expected[i].toString(16) + '.';
    }
  }

  return 'buffers are equal';
}
