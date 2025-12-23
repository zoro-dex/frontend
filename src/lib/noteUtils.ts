import { Note } from '@demox-labs/miden-sdk';
import { Buffer } from 'buffer';

/**
 * Deserialize a base64-encoded note back to a Note object
 */
export function deserializeNote(noteData: string): Note {
  const noteBytes = Buffer.from(noteData, 'base64');
  return Note.deserialize(new Uint8Array(noteBytes));
}
