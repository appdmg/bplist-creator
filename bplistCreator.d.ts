/// <reference types="node" />

declare function createBinaryPlist(value: createBinaryPlist.PlistValue): Buffer;

declare namespace createBinaryPlist {
  class Real {
    constructor(value: number);
    value: number;
  }

  type PlistValue =
    | boolean
    | number
    | bigint
    | string
    | Date
    | Buffer
    | Real
    | PlistValue[]
    | { UID: number }
    | PlistObject
    | PlistOverride;

  interface PlistObject {
    [key: string]: PlistValue;
  }

  interface PlistOverride {
    bplistOverride: true;
    type: 'array' | 'boolean' | 'data' | 'date' | 'dict' | 'double' | 'number' | 'string' | 'string-utf16' | 'UID';
    value: unknown;
  }
}

export = createBinaryPlist;
