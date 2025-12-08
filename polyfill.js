import { Blob } from 'buffer';

// Polyfill para a classe File global que falta no Node.js 18
// Necessário para bibliotecas como @google/genai e fetch que dependem de undici
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