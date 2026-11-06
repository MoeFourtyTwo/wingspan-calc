/**
 * Quick-sum tally: framework-free logic behind the "add up the cards" pad.
 *
 * State is immutable: every operation returns a new `Tally`. Each change pushes
 * the previous term list onto an undo stack, so Undo also reverts Clear and
 * single-term removals.
 */
import type { Category } from '../rules/scoring';

export interface Term {
    /** Stable id so the UI can key / animate terms. */
    id: number;
    value: number;
    /** The player's value from before the tally was opened. */
    seed?: boolean;
}

export interface Tally {
    terms: readonly Term[];
    /** Previous term lists, most recent last. */
    history: readonly (readonly Term[])[];
    /** Next id to hand out. */
    nextId: number;
}

/** Upper bound on the undo stack, plenty for a tally of ~15 cards. */
export const MAX_HISTORY = 100;

/**
 * Start a tally. A non-zero `initial` value (what the player already has) is
 * kept as the first, "seed" term, so opening the pad never silently drops a value:
 * keep tallying to add to it, or tap it / Clear to start from scratch.
 */
export function createTally(initial = 0): Tally {
    const value = toInt(initial);
    const terms: Term[] = value !== 0 ? [{ id: 0, value, seed: true }] : [];
    return { terms, history: [], nextId: 1 };
}

function toInt(value: number): number {
    return Number.isFinite(value) ? Math.trunc(value) || 0 : 0;
}

function commit(tally: Tally, terms: readonly Term[], nextId = tally.nextId): Tally {
    const history = [...tally.history, tally.terms].slice(-MAX_HISTORY);
    return { terms, history, nextId };
}

export function addTerm(tally: Tally, value: number): Tally {
    if (!Number.isFinite(value)) return tally;
    const term: Term = { id: tally.nextId, value: toInt(value) };
    return commit(tally, [...tally.terms, term], tally.nextId + 1);
}

export function removeTerm(tally: Tally, id: number): Tally {
    if (!tally.terms.some(t => t.id === id)) return tally;
    return commit(
        tally,
        tally.terms.filter(t => t.id !== id),
    );
}

export function clearTally(tally: Tally): Tally {
    if (tally.terms.length === 0) return tally;
    return commit(tally, []);
}

export function canUndo(tally: Tally): boolean {
    return tally.history.length > 0;
}

export function undo(tally: Tally): Tally {
    if (!canUndo(tally)) return tally;
    return {
        terms: tally.history[tally.history.length - 1],
        history: tally.history.slice(0, -1),
        nextId: tally.nextId,
    };
}

export function sum(tally: Tally): number {
    return tally.terms.reduce((acc, t) => acc + t.value, 0);
}

/** Number of terms entered during this tally (the seed value does not count). */
export function count(tally: Tally): number {
    return tally.terms.filter(t => !t.seed).length;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Quick-add chips offered for each category. */
export function chipsFor(category: Category): number[] {
    switch (category) {
        case 'birds':
            return range(0, 9); // printed bird card values
        case 'eggs':
            return range(1, 6); // eggs on one bird
        case 'food':
        case 'tucked':
            return range(1, 5);
        case 'bonus':
            return range(1, 10);
        case 'hummingbirds':
            return range(-3, 10); // track values beside a marker
        case 'round_goals':
            return range(0, 5); // casual side: 0..5 per round
        default:
            return range(1, 9);
    }
}

/** What one term stands for, used to pick the count label ("5 cards"). */
export type TermUnit = 'card' | 'bird' | 'marker' | 'round';

export function unitFor(category: Category): TermUnit {
    switch (category) {
        case 'birds':
        case 'bonus':
            return 'card';
        case 'hummingbirds':
            return 'marker';
        case 'round_goals':
        case 'nectar':
            return 'round';
        default:
            return 'bird'; // eggs, food, tucked: counted per bird
    }
}

/**
 * Format the tally as an expression, e.g. "5 + 3 − 2 = 6".
 * Uses a real minus sign (U+2212) for readability.
 */
export function formatExpression(tally: Tally): string {
    if (tally.terms.length === 0) return '0';
    const parts = tally.terms.map((t, i) => {
        const abs = String(Math.abs(t.value));
        if (i === 0) return t.value < 0 ? `−${abs}` : abs;
        return `${t.value < 0 ? '−' : '+'} ${abs}`;
    });
    return `${parts.join(' ')} = ${formatSigned(sum(tally))}`;
}

function formatSigned(n: number): string {
    return n < 0 ? `−${Math.abs(n)}` : String(n);
}
