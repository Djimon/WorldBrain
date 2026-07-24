// M15-S04 / #295: Grid-bewusster Fog-Stempel — reine Zellgeometrie.
// Wiederverwendet das Koordinatenschema aus MapGrid.tsx (cellKeyFor:
// "{col}:{row}", square = einfaches Raster, hex-flat = versetzte Spalten).
// Kein neues Geometrie-System — nur die Radius-Aufzählung um eine Mittelzelle.
import type { GridSettings } from './MapGrid';

export type FogStampGridType = GridSettings['type'];
export type FogStampLevel = 0 | 1 | 2 | 3 | 4;

export interface CellCoord {
  col: number;
  row: number;
}

// AC 4: square r0..r4 -> 1/9/25/49/81 Zellen; hex r0..r4 -> 1/7/19/37/61
// Zellen (zentrierte Hexagonalzahlen / Hex-Ring-Summe).
export function stampCellCount(_level: FogStampLevel, _gridType: FogStampGridType): number {
  throw new Error('not implemented');
}

// Alle Zellen, die der Stempel bei Stufe `level` abdeckt, zentriert auf
// `center`. square = (2*level+1)x(2*level+1)-Block; hex-flat = Hex-Ring-Summe
// (zentrierte Hexagonalzahl) im Offset-Koordinatenschema aus MapGrid.tsx.
export function stampCells(_center: CellCoord, _level: FogStampLevel, _gridType: FogStampGridType): CellCoord[] {
  throw new Error('not implemented');
}

export function cellCoordKey(cell: CellCoord): string {
  return `${cell.col}:${cell.row}`;
}
