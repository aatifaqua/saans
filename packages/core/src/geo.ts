/**
 * Two decimals is about 1 km: precise enough for city air, it avoids sending an exact home
 * position, and it lets nearby users share one cached forecast.
 */
export const round2 = (value: number): number => Math.round(value * 100) / 100;
