import { describe, expect, it } from 'vitest';
import {
  hasValidDocumentBytes,
  isValidBackupObjectPath,
} from '../scripts/private-storage-backup.mjs';

const validObjectPath = 'patrimonio/80000000-0000-4000-8000-000000000001/90000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.pdf';

describe('private storage backup validation', () => {
  it('accepts only generated document object paths', () => {
    expect(isValidBackupObjectPath(validObjectPath)).toBe(true);
    expect(isValidBackupObjectPath('../manifest.json')).toBe(false);
    expect(isValidBackupObjectPath(`patrimonio/${validObjectPath}`)).toBe(false);
  });

  it('validates byte signatures and rejects oversized or mislabeled files', () => {
    expect(hasValidDocumentBytes(Buffer.from('%PDF-1.7\nbody'), 'application/pdf')).toBe(true);
    expect(hasValidDocumentBytes(Buffer.from('\uFEFF <?xml version="1.0"?>'), 'application/xml')).toBe(true);
    expect(hasValidDocumentBytes(Buffer.from('<xml/>'), 'application/pdf')).toBe(false);
    expect(hasValidDocumentBytes(Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), 'application/xml')).toBe(false);
  });
});
