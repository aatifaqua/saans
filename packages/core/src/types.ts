/** Indian National AQI bands, cleanest first; the order is used for comparisons. */
export const BANDS = ['good', 'satisfactory', 'moderate', 'poor', 'veryPoor', 'severe'] as const;
export type Band = (typeof BANDS)[number];

/** Who lives in the home; each group changes how cautious the routine must be. */
export const MEMBERS = ['child', 'adult', 'olderAdult', 'pregnant'] as const;
export type Member = (typeof MEMBERS)[number];

/** Health conditions that make smog exposure riskier. */
export const SENSITIVITIES = ['asthma', 'heartOrLung'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

/** How the household usually travels for work or school. */
export const COMMUTES = ['walk', 'cycle', 'publicTransport', 'twoWheeler', 'car', 'none'] as const;
export type Commute = (typeof COMMUTES)[number];

/** Every indoor air hack in the catalogue, in priority order. */
export const HACK_IDS = [
  'wellFittedMask',
  'sealGaps',
  'cleanRoom',
  'purifierRunTimes',
  'purifierSizing',
  'boxFanFilter',
  'ventilateCleanHour',
  'carRecirculate',
  'kitchenExhaust',
  'noIncense',
  'wetMop',
  'noBurning',
  'plantsMyth',
] as const;
export type HackId = (typeof HACK_IDS)[number];

/** The family profile the routine is personalised for. It is stored only in the browser. */
export interface Household {
  readonly members: Readonly<Record<Member, number>>;
  readonly sensitivities: readonly Sensitivity[];
  readonly commute: Commute;
  readonly outdoorExercise: boolean;
  readonly hasPurifier: boolean;
}

/** One forecast hour; `time` is local to the place ("YYYY-MM-DDTHH:00"), gaps are null. */
export interface HourReading {
  readonly time: string;
  readonly pm25: number | null;
  readonly pm10: number | null;
}

export interface HourAqi {
  readonly time: string;
  readonly aqi: number;
  readonly band: Band;
}

/** A run of consecutive hours; `end` is exclusive. */
export interface AirWindow {
  readonly start: string;
  readonly end: string;
  readonly meanAqi: number;
  readonly band: Band;
  /** True when no hour met the household threshold and this is only the least harmful hour. */
  readonly leastBad: boolean;
}

/** Everything the routine is grounded on for the next 24 hours. */
export interface DayOutlook {
  readonly now: HourAqi | null;
  /** Up to 48 hours from now, for the forecast strip. */
  readonly hours: readonly HourAqi[];
  readonly best: readonly AirWindow[];
  readonly worst: AirWindow | null;
  /** The next 24 hours average Very Poor or worse. */
  readonly episode: boolean;
  /** The worst band at which this household should still go outdoors. */
  readonly threshold: Band;
}

/** A household-specific precaution and the fact about the household that triggered it. */
export interface Note {
  readonly text: string;
  readonly why: string;
}

/** Today's plan as Gemini writes it; the server validates it against this shape. */
export interface Plan {
  readonly summary: string;
  readonly routine: readonly {
    readonly time: string;
    readonly action: string;
    readonly why: string;
  }[];
  readonly lowEmission: readonly { readonly tip: string; readonly why: string }[];
  readonly hacks: readonly { readonly id: HackId; readonly how: string }[];
}

/** A place the forecast is fetched for; `name` is what the user sees and the model is told. */
export interface Place {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
}

/** Shown on every surface that gives advice: the UI, API responses, prompts and errors. */
export const DISCLAIMER =
  'General guidance, not medical advice. If anyone has trouble breathing or chest pain, seek medical care.';
