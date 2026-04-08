import {gcd} from 'xen-dev-utils';
import {mosGeneratorMonzo} from './helpers.js';

/**
 * Valid nominals for absolute pitches in [Diamond mos notation](https://en.xen.wiki/w/Diamond-mos_notation).
 */
export type DiamondMosAlphabet =
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';

/**
 * Count of L steps followed by count of s steps.
 */
export type MosMonzo = [number, number];

/**
 * 0-indexed degree of [Diamond mos notation](https://en.xen.wiki/w/Diamond-mos_notation).
 */
export type DiamondMosDegree = {
  /**
   * Center of this degree. A perfect or a neutral interval.
   */
  center: MosMonzo;
  /**
   * Quality of this degree. Imperfect has a neutral center and must be further processed to obtain the minor and major variants.
   */
  perfect: boolean;
  /**
   * The neutral interval for perfect intervals where it makes sense.
   */
  mid?: MosMonzo;
};

/**
 * [Diamond mos notation](https://en.xen.wiki/w/Diamond-mos_notation) configuration.
 */
export type DiamondMosNotation = {
  /**
   * Counts of [L, s] steps for every available nominal with J at unison. Add equaves to reach other octaves.
   */
  scale: Map<string, MosMonzo>;
  /**
   * Interval of equivalence / octave.
   */
  equave: MosMonzo;
  /**
   * 0-indexed degree of the scale for one period. Add periods to reach further.
   */
  degrees: DiamondMosDegree[];
  /**
   * Interval of repetition.
   */
  period: MosMonzo;
  /**
   * Bright generator of the scale.
   */
  brightGenerator: MosMonzo;
};

/** Allowed TAMNAMS qualities for intervals/degrees. */
export type MosQuality =
  | 'perfect'
  | 'major'
  | 'minor'
  | 'augmented'
  | 'diminished';

/** Single characters of valid nominals. */
export const DIAMOND_MOS_ALPHABET: DiamondMosAlphabet[] = [
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

/**
 * Obtain the 0-indexed nth generalized Diamond-mos nominal.
 * @param n Index of the nominal.
 * @returns A single character from J through Z or a multi-character string like 'JJ' starting from n = 17.
 */
export function nthNominal(n: number): string {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Invalid nominal index');
  }
  if (n >= DIAMOND_MOS_ALPHABET.length) {
    return (
      nthNominal(Math.floor(n / DIAMOND_MOS_ALPHABET.length) - 1) +
      DIAMOND_MOS_ALPHABET[n % DIAMOND_MOS_ALPHABET.length]
    );
  }
  return DIAMOND_MOS_ALPHABET[n];
}

/**
 * Generate configuration for [Diamond mos notation](https://en.xen.wiki/w/Diamond-mos_notation).
 *
 * Always based on J and 0-indexed even if scale is diatonic.
 * @param mode Mode of a MOS scale such as 'LLsLLLs'.
 * @returns Configuration for notation software.
 */
export function generateNotation(mode: string): DiamondMosNotation {
  const scale = new Map<string, MosMonzo>();
  let i = 0;
  const monzo: MosMonzo = [0, 0];
  let hasLarge = false;
  let hasSmall = false;
  for (const character of mode) {
    scale.set(nthNominal(i++), [...monzo]);
    if (character === 'L') {
      monzo[0]++;
      hasLarge = true;
    } else if (character === 's') {
      monzo[1]++;
      hasSmall = true;
    } else {
      throw new Error(`Invalid abstract step '${character}'.`);
    }
  }
  if (!hasLarge || !hasSmall) {
    throw new Error("The scale must contain both 'L' and 's' steps.");
  }
  const equave: MosMonzo = [...monzo];
  const numPeriods = gcd(equave[0], equave[1]);
  const period: MosMonzo = [equave[0] / numPeriods, equave[1] / numPeriods];
  const gen = mosGeneratorMonzo(period[0], period[1]);
  const numUnique = period[0] + period[1];
  const edoperiod = 2 * period[0] + period[1];
  const basic: [number, MosMonzo, boolean, MosMonzo?][] = [
    [0, [0, 0], true, undefined],
  ];
  // Exception for nL ns
  if (numUnique === 2) {
    basic.push([2, [gen[0] - 0.5, gen[1] + 0.5], false, undefined]);
  } else {
    // Dark mid
    basic.push([
      edoperiod - 2 * gen[0] - gen[1],
      [period[0] - gen[0], period[1] - gen[1]],
      true,
      [period[0] - gen[0] + 0.5, period[1] - gen[1] - 0.5],
    ]);
    let edostep = 2 * gen[0] + gen[1];
    // Bright mid
    basic.push([edostep, [...gen], true, [gen[0] - 0.5, gen[1] + 0.5]]);
    monzo[0] = gen[0];
    monzo[1] = gen[1];
    for (let i = 2; i < numUnique - 1; ++i) {
      edostep += 2 * gen[0] + gen[1];
      monzo[0] += gen[0];
      monzo[1] += gen[1];
      while (edostep >= edoperiod) {
        edostep -= edoperiod;
        monzo[0] -= period[0];
        monzo[1] -= period[1];
      }
      // Imperfect central
      basic.push([edostep, [monzo[0] - 0.5, monzo[1] + 0.5], false, undefined]);
    }
  }

  basic.sort((a, b) => a[0] - b[0]);
  const degrees: DiamondMosDegree[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [_, center, perfect, mid] of basic) {
    degrees.push({center, perfect, mid});
  }
  return {
    scale,
    degrees,
    equave,
    period,
    brightGenerator: gen,
  };
}

function monzoToEdo(monzo: MosMonzo): number {
  return 2 * monzo[0] + monzo[1];
}

function qualityAbbreviation(quality: MosQuality) {
  switch (quality) {
    case 'perfect':
      return 'P';
    case 'major':
      return 'M';
    case 'minor':
      return 'm';
    case 'augmented':
      return 'A';
    case 'diminished':
      return 'd';
  }
}

function inferredQuality(
  mode: string,
  degree: number,
  treatAsDegree: boolean,
): MosQuality {
  const notation = generateNotation(mode);
  const period = notation.degrees.length;
  const reduced = ((degree % period) + period) % period;
  const nominal = notation.scale.get(nthNominal(reduced))!;
  const nominalEdo = monzoToEdo(nominal);
  const info = notation.degrees[reduced];
  const centerEdo = monzoToEdo(info.center);
  if (!info.perfect) {
    return nominalEdo < centerEdo ? 'minor' : 'major';
  }
  if (nominalEdo === centerEdo || info.mid === undefined) {
    return 'perfect';
  }
  const midEdo = monzoToEdo(info.mid);
  const rarerIsAugmented = midEdo > centerEdo;
  if (treatAsDegree) {
    // Mode degrees without explicit alterations are always treated as unmodified.
    return 'perfect';
  }
  return rarerIsAugmented ? 'augmented' : 'diminished';
}

/**
 * Name a k-mosstep interval according to TAMNAMS.
 * @param mode Mode in step pattern format, such as "LLsLLLs".
 * @param mosSteps 0-indexed interval class in mossteps.
 * @param abbreviated If true returns abbreviations such as P5ms instead of long names.
 */
export function mosIntervalName(
  mode: string,
  mosSteps: number,
  abbreviated = false,
): string {
  const quality = inferredQuality(mode, mosSteps, false);
  if (abbreviated) {
    return `${qualityAbbreviation(quality)}${mosSteps}ms`;
  }
  return `${quality[0]!.toUpperCase()}${quality.slice(1)} ${mosSteps}-mosstep`;
}

/**
 * Name a k-mosdegree according to TAMNAMS.
 * @param mode Mode in step pattern format, such as "LLsLLLs".
 * @param degree 0-indexed degree in mossteps from the tonic.
 * @param abbreviated If true returns abbreviations such as m2md instead of long names.
 */
export function mosDegreeName(
  mode: string,
  degree: number,
  abbreviated = false,
): string {
  const quality = inferredQuality(mode, degree, true);
  if (abbreviated) {
    return `${qualityAbbreviation(quality)}${degree}md`;
  }
  return `${quality[0]!.toUpperCase()}${quality.slice(1)} ${degree}-mosdegree`;
}

/**
 * Format a TAMNAMS-style chord label: "<root-degree>(<interval-list>)".
 * @param mode Mode in step pattern format, such as "LsLLsLLs".
 * @param rootDegree Degree of the chord root.
 * @param chordIntervals Intervals from the chord root in mossteps.
 * @returns A chord label such as "m2md(0ms 2ms 4ms)".
 */
export function mosChordName(
  mode: string,
  rootDegree: number,
  chordIntervals: number[],
): string {
  const root = mosDegreeName(mode, rootDegree, true);
  const tones = chordIntervals.map(interval => `${interval}ms`).join(' ');
  return `${root}(${tones})`;
}
