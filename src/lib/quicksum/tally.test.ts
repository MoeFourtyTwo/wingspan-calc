import { describe, expect, test } from 'vitest';
import { CATEGORIES } from '../rules/scoring';
import {
    MAX_HISTORY,
    addTerm,
    canUndo,
    chipsFor,
    clearTally,
    count,
    createTally,
    formatExpression,
    removeTerm,
    sum,
    undo,
    unitFor,
    type Tally,
} from './tally';

const addAll = (t: Tally, values: number[]) => values.reduce(addTerm, t);

describe('createTally', () => {
    test('starts empty for zero / missing values', () => {
        expect(createTally().terms).toEqual([]);
        expect(createTally(0).terms).toEqual([]);
        expect(sum(createTally())).toBe(0);
        expect(canUndo(createTally())).toBe(false);
    });

    test('keeps an existing value as a seed term', () => {
        const t = createTally(12);
        expect(t.terms).toEqual([{ id: 0, value: 12, seed: true }]);
        expect(sum(t)).toBe(12);
        expect(count(t)).toBe(0);
    });

    test('seeds negative values and ignores junk', () => {
        expect(sum(createTally(-4))).toBe(-4);
        expect(createTally(Number.NaN).terms).toEqual([]);
        expect(sum(createTally(3.9))).toBe(3);
    });
});

describe('adding and removing', () => {
    test('sums terms and counts them', () => {
        const t = addAll(createTally(), [5, 3, 9, 0, 4]);
        expect(sum(t)).toBe(21);
        expect(count(t)).toBe(5);
        expect(t.terms.map(x => x.value)).toEqual([5, 3, 9, 0, 4]);
    });

    test('zero is a real term (a 0-point bird still counts as a card)', () => {
        const t = addTerm(createTally(), 0);
        expect(count(t)).toBe(1);
        expect(sum(t)).toBe(0);
    });

    test('ids are unique, even after removal', () => {
        let t = addAll(createTally(7), [1, 2]);
        t = removeTerm(t, t.terms[1].id);
        t = addTerm(t, 3);
        const ids = t.terms.map(x => x.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('supports negative terms', () => {
        const t = addAll(createTally(), [5, -3, -2, 10]);
        expect(sum(t)).toBe(10);
    });

    test('ignores non-finite values and truncates fractions', () => {
        let t = addTerm(createTally(), Number.POSITIVE_INFINITY);
        expect(t.terms).toEqual([]);
        t = addTerm(t, 2.7);
        expect(sum(t)).toBe(2);
    });

    test('removes a specific term, including the seed', () => {
        let t = addAll(createTally(10), [4, 6]);
        t = removeTerm(t, t.terms[1].id);
        expect(t.terms.map(x => x.value)).toEqual([10, 6]);
        t = removeTerm(t, 0);
        expect(sum(t)).toBe(6);
    });

    test('removing an unknown id is a no-op without history', () => {
        const t = addTerm(createTally(), 1);
        expect(removeTerm(t, 999)).toBe(t);
    });

    test('does not mutate the previous state', () => {
        const a = addTerm(createTally(), 1);
        const b = addTerm(a, 2);
        expect(a.terms.length).toBe(1);
        expect(b.terms.length).toBe(2);
    });
});

describe('undo and clear', () => {
    test('undo reverts additions one by one', () => {
        let t = addAll(createTally(), [1, 2, 3]);
        t = undo(t);
        expect(sum(t)).toBe(3);
        t = undo(t);
        t = undo(t);
        expect(t.terms).toEqual([]);
        expect(canUndo(t)).toBe(false);
        expect(undo(t)).toBe(t);
    });

    test('undo restores a removed term', () => {
        let t = addAll(createTally(), [4, 5]);
        const removed = t.terms[0];
        t = removeTerm(t, removed.id);
        t = undo(t);
        expect(t.terms[0]).toEqual(removed);
    });

    test('clear empties the tally and is undoable', () => {
        let t = addAll(createTally(8), [1, 2]);
        t = clearTally(t);
        expect(sum(t)).toBe(0);
        expect(t.terms).toEqual([]);
        t = undo(t);
        expect(sum(t)).toBe(11);
    });

    test('clearing an empty tally adds no history', () => {
        const t = createTally();
        expect(clearTally(t)).toBe(t);
    });

    test('ids stay unique after undo', () => {
        let t = addAll(createTally(), [1, 2]);
        t = undo(t);
        t = addTerm(t, 3);
        const ids = t.terms.map(x => x.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('history is bounded', () => {
        const t = addAll(createTally(), Array.from({ length: MAX_HISTORY + 20 }, () => 1));
        expect(t.history.length).toBe(MAX_HISTORY);
        expect(sum(t)).toBe(MAX_HISTORY + 20);
    });
});

describe('chips', () => {
    test('bird cards are worth 0–9', () => {
        expect(chipsFor('birds')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    test('eggs per bird 1–6, food / tucked 1–5, bonus 1–10', () => {
        expect(chipsFor('eggs')).toEqual([1, 2, 3, 4, 5, 6]);
        expect(chipsFor('food')).toEqual([1, 2, 3, 4, 5]);
        expect(chipsFor('tucked')).toEqual([1, 2, 3, 4, 5]);
        expect(chipsFor('bonus')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test('hummingbird chips include negatives', () => {
        const chips = chipsFor('hummingbirds');
        expect(chips[0]).toBe(-3);
        expect(chips.at(-1)).toBe(10);
        expect(chips).toContain(0);
    });

    test('casual round goals 0–5 per round', () => {
        expect(chipsFor('round_goals')).toEqual([0, 1, 2, 3, 4, 5]);
    });

    test('every category has unique, ascending chips', () => {
        for (const c of CATEGORIES) {
            const chips = chipsFor(c);
            expect(chips.length).toBeGreaterThan(0);
            expect([...chips].sort((a, b) => a - b)).toEqual(chips);
            expect(new Set(chips).size).toBe(chips.length);
        }
    });

    test('units per category', () => {
        expect(unitFor('birds')).toBe('card');
        expect(unitFor('bonus')).toBe('card');
        expect(unitFor('eggs')).toBe('bird');
        expect(unitFor('hummingbirds')).toBe('marker');
        expect(unitFor('round_goals')).toBe('round');
    });
});

describe('formatExpression', () => {
    test('formats a sum', () => {
        expect(formatExpression(addAll(createTally(), [5, 3, 9, 0, 4]))).toBe('5 + 3 + 9 + 0 + 4 = 21');
    });

    test('uses minus signs for negative terms and totals', () => {
        expect(formatExpression(addAll(createTally(), [-3, 1, -2]))).toBe('−3 + 1 − 2 = −4');
    });

    test('empty tally', () => {
        expect(formatExpression(createTally())).toBe('0');
    });
});
