/**
 * World dimensions used by the generated map, camera bounds, and clamps.
 */
export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1600;

/**
 * Visual grid size for the ocean background.
 */
export const MAP_TILE_SIZE = 120;

/**
 * Rock generation range. Rocks are collidable obstacles reported as
 * `player:hit` when the local submarine intersects them.
 */
export const ROCK_CONFIG = {
  minCount: 3,
  maxCount: 5,
  minWidth: 120,
  maxWidth: 220,
  minHeight: 70,
  maxHeight: 130,
  density: 0.0000016,
};

/**
 * Seaweed generation range. Seaweed is visual decoration and is not exposed as
 * collision geometry.
 */
export const SEAWEED_CONFIG = {
  minCount: 5,
  maxCount: 8,
  minWidth: 12,
  maxWidth: 24,
  minHeight: 80,
  maxHeight: 150,
  density: 0.0000027,
};

/**
 * Maximum opacity for the depth overlay applied as the local player descends.
 */
export const DEPTH_OVERLAY_MAX_ALPHA = 0.7;
