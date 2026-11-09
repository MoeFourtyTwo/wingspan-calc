/** Normalised card data used by the bonus card checker. */

export type Lang = 'en' | 'de';

/** Main card sets plus the regional promo packs. */
export type BirdSet = string;

export interface Text {
    en: string;
    de: string | null;
}

export interface Ruling {
    /** Plain text (HTML from the source is stripped). */
    text: string;
    /** Link to the official answer, if any. */
    source: string | null;
}

export type Habitat = 'forest' | 'grassland' | 'wetland';
export type Nest = 'bowl' | 'cavity' | 'ground' | 'platform' | 'wild' | 'none';

export interface Bird {
    id: number;
    set: BirdSet;
    /** Hummingbird cards from the Americas expansion. */
    hummingbird: boolean;
    name: Text;
    scientific: string;
    points: number | null;
    habitats: Habitat[];
    nest: Nest;
    eggLimit: number | null;
    /** Wingspan in cm; "*" = flightless, counts as any wingspan; null = unknown. */
    wingspan: number | '*' | null;
    /** Food in the cost, e.g. { seed: 1, fish: 2 }; `wild` = any food. */
    food: Partial<Record<'invertebrate' | 'seed' | 'fish' | 'fruit' | 'rodent' | 'nectar' | 'wild', number>>;
    foodTotal: number | null;
    /** "/" in the cost: pay one of the listed foods. */
    foodSlash: boolean;
    predator: boolean;
    flocking: boolean;
    /** Power lets you draw or score bonus cards. */
    bonusPower: boolean;
    power: Text;
    /**
     * Bonus cards (by English card name) this bird qualifies for according
     * to the data's flags. `flagsDe` holds the German edition's flags for the
     * four name-based cards (null = no German name known).
     */
    flags: string[];
    flagsDe: string[] | null;
    rulings: Ruling[];
}

export interface BonusCard {
    id: number;
    set: BirdSet;
    name: Text;
    condition: Text;
    explanation: Text;
    scoring: Text;
    note: Text;
    rulings: Ruling[];
}

export interface CheckerData {
    birds: Bird[];
    bonusCards: BonusCard[];
}
