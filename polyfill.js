import { Blob } from 'buffer';

if (typeof global.File === 'undefined') {
  global.File = class File extends Blob {
    constructor(fileBits, fileName, options) {
      super(fileBits, options);
      this.name = fileName || 'unknown';
      this.lastModified = options?.lastModified || Date.now();
    }
  };
}

export default global.File;