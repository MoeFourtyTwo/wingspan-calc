/**
 * Double-sided round goal tiles for the normal (competitive / casual) game.
 *
 * The Wingspan Asia tiles are left out: they only exist for the 2-player
 * duet map. German texts follow the Feuerland wording where it is known
 * (European and Oceania tiles); the others are descriptive translations.
 * The Americas tiles refer to the five hummingbird groups of the
 * hummingbird track (bee, brilliant, emerald, mango, topaz).
 */
import type { GoalTile } from './types';

export const GOAL_TILES: readonly GoalTile[] = [
    // Core game: 8 tiles
    { id: 'core-forest', set: 'core', sides: [{ en: 'Birds in [forest]', de: 'Vögel im [forest]' }, { en: 'Eggs in [forest]', de: 'Eier im [forest]' }] },
    { id: 'core-grassland', set: 'core', sides: [{ en: 'Birds in [grassland]', de: 'Vögel im [grassland]' }, { en: 'Eggs in [grassland]', de: 'Eier im [grassland]' }] },
    { id: 'core-wetland', set: 'core', sides: [{ en: 'Birds in [wetland]', de: 'Vögel im [wetland]' }, { en: 'Eggs in [wetland]', de: 'Eier im [wetland]' }] },
    { id: 'core-bowl', set: 'core', sides: [{ en: '[bowl] birds with eggs', de: 'Schalennest-Vögel mit Eiern' }, { en: 'Eggs in [bowl] nests', de: 'Eier in Schalennestern' }] },
    { id: 'core-cavity', set: 'core', sides: [{ en: '[cavity] birds with eggs', de: 'Höhlennest-Vögel mit Eiern' }, { en: 'Eggs in [cavity] nests', de: 'Eier in Höhlennestern' }] },
    { id: 'core-ground', set: 'core', sides: [{ en: '[ground] birds with eggs', de: 'Bodennest-Vögel mit Eiern' }, { en: 'Eggs in [ground] nests', de: 'Eier in Bodennestern' }] },
    { id: 'core-platform', set: 'core', sides: [{ en: '[platform] birds with eggs', de: 'Plattformnest-Vögel mit Eiern' }, { en: 'Eggs in [platform] nests', de: 'Eier in Plattformnestern' }] },
    { id: 'core-sets', set: 'core', sides: [{ en: 'Sets of 1 egg in each habitat', de: 'Sets aus je 1 Ei in jedem Lebensraum' }, { en: 'Total birds', de: 'Vögel insgesamt' }] },

    // European expansion: 5 tiles
    { id: 'eu-row', set: 'european', sides: [{ en: 'Birds in one row', de: 'Vögel in einer Reihe' }, { en: 'Filled columns', de: 'Komplett gefüllte Spalten' }] },
    { id: 'eu-eggs', set: 'european', sides: [{ en: 'Birds with no eggs', de: 'Vögel ohne Eier' }, { en: 'Birds worth more than 4 [point]', de: 'Vögel mit Wert größer 4 [point]' }] },
    { id: 'eu-tucked', set: 'european', sides: [{ en: 'Birds with tucked cards', de: 'Vögel mit Karten darunter' }, { en: 'Food cost of played birds', de: 'Futterkosten gespielter Vögel' }] },
    { id: 'eu-hand', set: 'european', sides: [{ en: 'Bird cards in hand', de: 'Vogelkarten auf der Hand' }, { en: 'Food in personal supply', de: 'Futter im eigenen Vorrat' }] },
    { id: 'eu-powers', set: 'european', sides: [{ en: 'Brown powers', de: 'Braune Fähigkeiten' }, { en: 'White & no powers', de: 'Weiße & keine Fähigkeiten' }] },

    // Oceania expansion: 4 tiles
    { id: 'oc-cubes', set: 'oceania', sides: [{ en: 'Cubes on "Play a bird"', de: 'Aktionswürfel auf „Vogel spielen“' }, { en: 'Birds worth ≤ 3 [point]', de: 'Vögel mit Wert ≤ 3 [point]' }] },
    { id: 'oc-beak', set: 'oceania', sides: [{ en: 'Beak pointing left', de: 'Schnabel zeigt nach links' }, { en: 'Beak pointing right', de: 'Schnabel zeigt nach rechts' }] },
    { id: 'oc-food', set: 'oceania', sides: [{ en: '[fruit] + [seed] in food cost of your birds', de: '[fruit] + [seed] in den Futterkosten deiner Vögel' }, { en: '[invertebrate] in food cost of your birds', de: '[invertebrate] in den Futterkosten deiner Vögel' }] },
    { id: 'oc-nogoal', set: 'oceania', sides: [{ en: '[rodent] + [fish] in food cost of your birds', de: '[rodent] + [fish] in den Futterkosten deiner Vögel' }, { en: 'No goal', de: 'Kein Ziel', noGoal: true }] },

    // Americas expansion: 5 tiles
    { id: 'am-parity', set: 'americas', sides: [{ en: 'Birds worth even points (0, 2, 4, 6, 8)', de: 'Vögel mit geradem Punktwert (0, 2, 4, 6, 8)' }, { en: 'Birds worth odd points (1, 3, 5, 7, 9)', de: 'Vögel mit ungeradem Punktwert (1, 3, 5, 7, 9)' }] },
    { id: 'am-values', set: 'americas', sides: [{ en: 'Different point values on birds', de: 'Verschiedene Punktwerte auf Vögeln' }, { en: 'Total of egg limits (blue side: ÷ 5)', de: 'Summe der Ei-Limits (blaue Seite: ÷ 5)' }] },
    { id: 'am-mango', set: 'americas', sides: [{ en: 'Hummingbird points', de: 'Kolibri-Punkte' }, { en: '[mango] track', de: '[mango]-Leiste' }] },
    { id: 'am-bee', set: 'americas', sides: [{ en: '[bee] track', de: '[bee]-Leiste' }, { en: '[emerald] track', de: '[emerald]-Leiste' }] },
    { id: 'am-brilliant', set: 'americas', sides: [{ en: '[brilliant] track', de: '[brilliant]-Leiste' }, { en: '[topaz] track', de: '[topaz]-Leiste' }] },
];
