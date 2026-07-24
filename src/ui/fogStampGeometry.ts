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
export function stampCellCount(level: FogStampLevel, gridType: FogStampGridType): number {
  if (gridType === 'square') return (2 * level + 1) ** 2;
  return 3 * level * (level + 1) + 1;
}

interface Cube { x: number; y: number; z: number }

// "odd-q" offset<->cube conversion (flat-top hex, columns offset vertically
// on odd columns) — matches MapGrid.tsx's cellKeyFor stagger:
// `cy = row*cellSize*0.866 + (col%2)*cellSize*0.433`.
function oddqToCube(col: number, row: number): Cube {
  const x = col;
  const z = row - (col - (col & 1)) / 2;
  return { x, y: -x - z, z };
}

function cubeToOddq(cube: Cube): CellCoord {
  return { col: cube.x, row: cube.z + (cube.x - (cube.x & 1)) / 2 };
}

// All cube coordinates within `level` steps of the origin (a hex "disk" —
// the union of rings 0..level around the center), standard hex-grid algorithm.
function hexDiskOffsets(level: FogStampLevel): Cube[] {
  const cells: Cube[] = [];
  for (let x = -level; x <= level; x++) {
    const yMin = Math.max(-level, -x - level);
    const yMax = Math.min(level, -x + level);
    for (let y = yMin; y <= yMax; y++) {
      cells.push({ x, y, z: -x - y });
    }
  }
  return cells;
}

// Alle Zellen, die der Stempel bei Stufe `level` abdeckt, zentriert auf
// `center`. square = (2*level+1)x(2*level+1)-Block; hex-flat = Hex-Ring-Summe
// (zentrierte Hexagonalzahl) im Offset-Koordinatenschema aus MapGrid.tsx.
export function stampCells(center: CellCoord, level: FogStampLevel, gridType: FogStampGridType): CellCoord[] {
  if (gridType === 'square') {
    const cells: CellCoord[] = [];
    for (let dc = -level; dc <= level; dc++) {
      for (let dr = -level; dr <= level; dr++) {
        cells.push({ col: center.col + dc, row: center.row + dr });
      }
    }
    return cells;
  }
  const centerCube = oddqToCube(center.col, center.row);
  return hexDiskOffsets(level).map((offset) =>
    cubeToOddq({ x: centerCube.x + offset.x, y: centerCube.y + offset.y, z: centerCube.z + offset.z }));
}

export function cellCoordKey(cell: CellCoord): string {
  return `${cell.col}:${cell.row}`;
}
