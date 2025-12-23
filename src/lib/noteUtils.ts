import { Note, WebClient } from '@demox-labs/miden-sdk';
import { Buffer } from 'buffer';

/**
 * Deserialize a base64-encoded note back to a Note object
 */
export function deserializeNote(noteData: string): Note {
  const noteBytes = Buffer.from(noteData, 'base64');
  return Note.fromBytes(new Uint8Array(noteBytes));
}

/**
 * Import a P2ID note received via WebSocket into the wallet
 * This adds the note to the client's known notes so it can be consumed
 */
export async function importP2IDNote(
  client: WebClient,
  noteData: string,
): Promise<string> {
  const note = deserializeNote(noteData);
  const noteId = note.id().toString();

  // Import the note into the client
  await client.importInputNote(note);

  return noteId;
}
