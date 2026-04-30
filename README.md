# @appdmg/bplist-creator

Binary macOS plist creator for the appdmg package family.

This package is a CommonJS-first modernization of `bplist-creator` for
Node.js 24 and newer. The public API remains the same shape: require the
package as a function, pass a JavaScript value, and receive a `Buffer`
containing a binary plist.

## Installation

```bash
npm install @appdmg/bplist-creator
```

## Usage

```javascript
const bplist = require('@appdmg/bplist-creator');

const buffer = bplist({
  key1: [1, 2, 3]
});
```

## Real Values

JavaScript uses one `number` type for both integer and floating-point values.
This package writes integer-looking numbers as binary plist integers. To force a
value to be written as a binary plist real, wrap it in `Real`.

```javascript
const bplist = require('@appdmg/bplist-creator');

const buffer = bplist({
  backgroundRed: new bplist.Real(1),
  backgroundGreen: new bplist.Real(0),
  backgroundBlue: new bplist.Real(0)
});
```

## Migration Notes

The package name changed from `bplist-creator` to
`@appdmg/bplist-creator`.

The supported runtime changed to Node.js 24 and newer.

The runtime dependency on `stream-buffers` was removed. Output remains covered by
byte-for-byte binary plist fixture tests.

## License

MIT
