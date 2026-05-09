// AgarioConfig.ts – v9 (Project V1.4.2)
// Changes:
//  • virus.splitMass lowered so mid-size cells also get split properly  
//  • virusSplit can now produce up to limitSplit (16) pieces
//  • hideRadiusFraction kept at 0.85 (generous hide window)
//  • Space / W keys confirmed via KEY_SPLIT=32, KEY_FIREFOOD=119
import { SkinsRegistry, getSkinById } from "./SkinsData.js";
// Export the registry so other files importing AgarioConfig can still access it if needed
export const ALL_SKINS = SkinsRegistry.map(s => s.id);
export { getSkinById };
export const AgarioConfig = {
    foodMass: 1,
    fireFood: 10,
    fireFoodMinMass: 20,
    limitSplit: 16, // max cell count from splitting
    defaultPlayerMass: 10,
    virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: { from: 100, to: 150 },
        splitMass: 130, // cells heavier than this explode on virus contact
        // Hide: cell radius must be ≤ this × virusRadius to hide inside
        hideRadiusFraction: 0.85,
        feedHitsToMove: 4,
        moveSpeed: 9,
        moveFriction: 0.88,
        minMoveSpeed: 0.3,
    },
    gameWidth: 10000,
    gameHeight: 10000,
    gameMass: 60000,
    maxFood: 3000,
    maxVirus: 200,
    foodCellSize: 250, // Spatial grid size for food regeneration
    localMaxFood: 5, // Max food per 250x250 grid cell
    slowBase: 4.5,
    massLossRate: 0.002, // 0.2% proportional decay per interval
    minMassLoss: 400,
    mergeTimer: 15,
    aoiRadius: 1800, // Requested pixel radius (will be clamped)
    MAX_AOI_RADIUS: 1400, // AUTHORITATIVE HARD CAP
};
