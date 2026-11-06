/** Small colour helpers for SVG tokens (eggs, birds, feathers). */

function parse(hex: string): [number, number, number] {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return [200, 200, 200];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) =>
    '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Mix towards white (amount > 0) or black (amount < 0). amount in [-1, 1]. */
export function shade(hex: string, amount: number): string {
    const rgb = parse(hex);
    const target = amount >= 0 ? 255 : 0;
    const a = Math.abs(amount);
    return toHex(rgb.map(v => v + (target - v) * a));
}

function luminance(hex: string): number {
    const [r, g, b] = parse(hex).map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable text colour on top of the given background. */
export function inkFor(hex: string): string {
    return luminance(hex) > 0.36 ? '#2b3a2f' : '#ffffff';
}
