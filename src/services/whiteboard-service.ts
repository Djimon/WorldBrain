// M10-S15 (#361): Spotlight/Whiteboard (D19). Campaign-scoped.
// - 'shared': für alle Spieler der Campaign; target_player_id = null.
// - 'private': nur der DM bespielt, nur der targetPlayerId sieht — genau eine
//   private Wand pro (campaignId, targetPlayerId).
// Elemente: entity_ref | text | image (payload_json trägt die Daten).
import type { DatabaseLike } from './entity-service';

export type BoardType = 'shared' | 'private';
export type ElementType = 'entity_ref' | 'text' | 'image';

export interface Whiteboard {
  id: string;
  campaign_id: string;
  type: BoardType;
  target_player_id: string | null;
  created_at: string;
}

export interface WhiteboardElement {
  id: string;
  whiteboard_id: string;
  element_type: ElementType;
  payload_json: string;
  x: number;
  y: number;
  created_at: string;
}

export interface CreateBoardParams {
  campaignId: string;
  type: BoardType;
  targetPlayerId?: string;
}

export async function createBoard(db: DatabaseLike, params: CreateBoardParams): Promise<Whiteboard> {
  if (params.type === 'private' && (params.targetPlayerId === undefined || params.targetPlayerId === '')) {
    throw new Error('Private whiteboard requires targetPlayerId');
  }
  const id = `wb_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  const target = params.type === 'private' ? params.targetPlayerId! : null;
  await db.execute(
    'INSERT INTO whiteboards (id, campaign_id, type, target_player_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, params.campaignId, params.type, target, created_at],
  );
  return { id, campaign_id: params.campaignId, type: params.type, target_player_id: target, created_at };
}

export async function listBoards(db: DatabaseLike, campaignId: string): Promise<Whiteboard[]> {
  return db.select<Whiteboard>(
    'SELECT id, campaign_id, type, target_player_id, created_at FROM whiteboards WHERE campaign_id = ? ORDER BY created_at',
    [campaignId],
  );
}

export interface PlaceElementParams {
  boardId: string;
  elementType: ElementType;
  payload: Record<string, unknown>;
  x?: number;
  y?: number;
}

export async function placeElement(db: DatabaseLike, params: PlaceElementParams): Promise<WhiteboardElement> {
  const id = `wbel_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  const x = params.x ?? 0;
  const y = params.y ?? 0;
  await db.execute(
    'INSERT INTO whiteboard_elements (id, whiteboard_id, element_type, payload_json, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.boardId, params.elementType, JSON.stringify(params.payload), x, y, created_at],
  );
  return {
    id, whiteboard_id: params.boardId, element_type: params.elementType,
    payload_json: JSON.stringify(params.payload), x, y, created_at,
  };
}

export async function listElements(db: DatabaseLike, boardId: string): Promise<WhiteboardElement[]> {
  return db.select<WhiteboardElement>(
    'SELECT id, whiteboard_id, element_type, payload_json, x, y, created_at FROM whiteboard_elements WHERE whiteboard_id = ? ORDER BY created_at',
    [boardId],
  );
}

export async function deleteElement(db: DatabaseLike, elementId: string): Promise<void> {
  await db.execute('DELETE FROM whiteboard_elements WHERE id = ?', [elementId]);
}
