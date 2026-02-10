// Shared constants for PageEditor grid layout
export const GRID_CONSTANTS = {
  ITEM_WIDTH: '16rem', // page width
  ITEM_HEIGHT: '17.5rem', // 16rem + 1.5rem gap
  ITEM_GAP: '1rem', // gap between items
  OVERSCAN_SMALL: 8, // Overscan for normal documents
  OVERSCAN_LARGE: 12, // Overscan for large documents (12 rows = ~96 pages pre-rendered)
} as const;