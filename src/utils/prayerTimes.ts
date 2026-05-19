/**
 * Astronomical Prayer Times Calculator (pure TypeScript)
 */

export type CalculationMethod = "UMM_AL_QURA" | "EGYPTIAN" | "MWL" | "ISNA";

export interface PrayerTimeConfig {
  method: CalculationMethod;
  latitude: number;
  longitude: number;
  timezone: number; // in hours, e.g. 3 for Riyadh
  offsets: {
    fajr: number;
    shuruq: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
  };
}

export interface PrayerTimes {
  fajr: string;
  shuruq: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  thirdOfNight: string;
  calculationDate: string;
}

// Default settings
export const DEFAULT_CONFIG: PrayerTimeConfig = {
  method: "UMM_AL_QURA",
  latitude: 24.7136, // Riyadh
  longitude: 46.6753,
  timezone: 3,
  offsets: {
    fajr: 0,
    shuruq: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0
  }
};

/**
 * Calculates prayer times for a given day and configuration
 */
export function calculatePrayerTimes(date: Date, config: PrayerTimeConfig): PrayerTimes {
  const lat = config.latitude;
  const lng = config.longitude;
  const timezone = config.timezone;

  // Simple astronomical estimation formulas
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 1. Calculate Julian Date minus 2451545.0 (Julian day of January 1, 2000, 12:00 universal time)
  // Approximate algorithm
  const d = (367 * year) - Math.floor(7 * (year + Math.floor((month + 9) / 12)) / 4) + Math.floor(275 * month / 9) + day - 730531.5;

  // 2. Solar coordinates
  const w = 282.9404 + 4.70935e-5 * d; // longitude of perihelion
  const e = 0.016709 - 1.151e-9 * d;   // eccentricity
  const M = (356.0470 + 0.9856002585 * d) % 360; // mean anomaly

  // Eccentric anomaly
  let E = M + (180 / Math.PI) * e * Math.sin(M * Math.PI / 180) * (1 + e * Math.cos(M * Math.PI / 180));
  E = E * Math.PI / 180;

  // Solar coordinates in rect system
  const x = Math.cos(E) - e;
  const y = Math.sin(E) * Math.sqrt(1 - e * e);

  const r = Math.sqrt(x * x + y * y);
  const v = Math.atan2(y, x) * 180 / Math.PI; // true anomaly

  const lon = (v + w) % 360; // solar longitude

  // Obliquity of ecliptic
  const obl = (23.4393 - 3.563e-7 * d) * Math.PI / 180;

  // Celestial coordinates
  const sinAlpha = Math.sin(lon * Math.PI / 180) * Math.cos(obl);
  const cosAlpha = Math.cos(lon * Math.PI / 180);
  const alpha = Math.atan2(sinAlpha, cosAlpha) * 180 / Math.PI; // right ascension

  const delta = Math.asin(Math.sin(lon * Math.PI / 180) * Math.sin(obl)); // inclination angle (declination)

  // 3. Equation of time & Mid-day
  const L = (280.460 + 0.9856474 * d) % 360;
  const equationOfTime = (L - alpha) / 15; // in hours
  
  // Base Dhuhr is noon in UTC, shifted by timezone and Equation of Time and longitude
  // Noon UTC = 12 - Lng/15 - Equation of Time
  const dhuhrUTC = 12 - (lng / 15) - equationOfTime;
  let dhuhrLocal = dhuhrUTC + timezone;
  if (dhuhrLocal < 0) dhuhrLocal += 24;
  if (dhuhrLocal >= 24) dhuhrLocal -= 24;

  // Calculate Sun altitude limits for Fajr and Isha based on the estimation standard
  let fajrAngle = 18.5; // Umm Al-Qura default
  let ishaAngleOrInterval = 90; // Minutes after Maghrib (Umm Al-Qura uses 90, 120 in Ramadan)

  switch (config.method) {
    case "UMM_AL_QURA":
      fajrAngle = 18.5;
      ishaAngleOrInterval = 90; // strictly 90 mins interval
      break;
    case "EGYPTIAN":
      fajrAngle = 19.5;
      ishaAngleOrInterval = 17.5; // Angle
      break;
    case "MWL":
      fajrAngle = 18.0;
      ishaAngleOrInterval = 17.0; // Angle
      break;
    case "ISNA":
      fajrAngle = 15.0;
      ishaAngleOrInterval = 15.0; // Angle
      break;
  }

  // Sunrise/Sunset calculations (-0.833 degrees for sun radius and atmospheric refraction)
  const angleSunrise = -0.833 * Math.PI / 180;
  const latRad = lat * Math.PI / 180;

  // Hour Angle for Sunrise
  const cosH_sunrise = (Math.sin(angleSunrise) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
  let H_sunrise = 0;
  if (cosH_sunrise >= -1 && cosH_sunrise <= 1) {
    H_sunrise = Math.acos(cosH_sunrise) * 180 / Math.PI / 15; // in hours
  } else {
    H_sunrise = 6; // default approximation
  }

  let sunriseLocal = dhuhrLocal - H_sunrise;
  let sunsetLocal = dhuhrLocal + H_sunrise;

  // Hour Angle for Fajr
  const angleFajrRad = -fajrAngle * Math.PI / 180;
  const cosH_fajr = (Math.sin(angleFajrRad) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
  let H_fajr = H_sunrise;
  if (cosH_fajr >= -1 && cosH_fajr <= 1) {
    H_fajr = Math.acos(cosH_fajr) * 180 / Math.PI / 15;
  }
  let fajrLocal = dhuhrLocal - H_fajr;

  // Asr calculation (Shafi/Hanafi calculation - standard Shafi is shadow factor = 1)
  const shadowFactor = 1; // Shafi/Maliki/Hanbali standard. (Hanafi shadowLength = 2)
  const acotVal = shadowFactor + Math.abs(Math.tan(latRad - delta));
  const angleAsrRad = Math.atan(1 / acotVal);
  const cosH_asr = (Math.sin(angleAsrRad) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
  let H_asr = 3;
  if (cosH_asr >= -1 && cosH_asr <= 1) {
    H_asr = Math.acos(cosH_asr) * 180 / Math.PI / 15;
  }
  let asrLocal = dhuhrLocal + H_asr;

  // Isha
  let ishaLocal = 0;
  if (config.method === "UMM_AL_QURA") {
    // Umm Al-Qura uses a fixed interval of 90 minutes after Maghrib (except Ramadan is 120, we keep 90)
    ishaLocal = sunsetLocal + (1.5); // 1.5 hours
  } else {
    const angleIshaRad = -(ishaAngleOrInterval as number) * Math.PI / 180;
    const cosH_isha = (Math.sin(angleIshaRad) - Math.sin(latRad) * Math.sin(delta)) / (Math.cos(latRad) * Math.cos(delta));
    let H_isha = H_sunrise;
    if (cosH_isha >= -1 && cosH_isha <= 1) {
      H_isha = Math.acos(cosH_isha) * 180 / Math.PI / 15;
    }
    ishaLocal = dhuhrLocal + H_isha;
  }

  // Format helper
  function doubleToTimeString(hoursValue: number, offsetMinutes: number): string {
    let finalHours = (hoursValue + offsetMinutes / 60) % 24;
    if (finalHours < 0) finalHours += 24;
    const hr = Math.floor(finalHours);
    const mn = Math.floor((finalHours - hr) * 60);
    return `${hr.toString().padStart(2, "0")}:${mn.toString().padStart(2, "0")}`;
  }

  // Apply user offsets
  const times = {
    fajr: doubleToTimeString(fajrLocal, config.offsets.fajr),
    shuruq: doubleToTimeString(sunriseLocal, config.offsets.shuruq),
    dhuhr: doubleToTimeString(dhuhrLocal, config.offsets.dhuhr),
    asr: doubleToTimeString(asrLocal, config.offsets.asr),
    maghrib: doubleToTimeString(sunsetLocal, config.offsets.maghrib),
    isha: doubleToTimeString(ishaLocal, config.offsets.isha),
  };

  // 4. Calculate Third of Night (قيام الليل)
  // High-performance computation:
  // Third of Night (Qiyam Al-Layl) calculates the last third of the interval between sunset (Maghrib) and next day's Sunrise or Fajr.
  // Standard Islamic consensus is: Qiyam Al-Layl timer starts at sunset (Maghrib) and ends at sunrise or Fajr. To find Third of Night:
  // Total night duration = (Fajr time of next day - Maghrib time of today).
  // The last third starts at: Fajr - (Total night duration / 3).
  // Let's implement this calculation precisely.
  const maghribMins = timeToMinutes(times.maghrib);
  const fajrMins = timeToMinutes(times.fajr);
  
  // Total duration of night in minutes
  let nightTotalMins = 0;
  if (fajrMins > maghribMins) {
    nightTotalMins = fajrMins - maghribMins;
  } else {
    nightTotalMins = (1440 - maghribMins) + fajrMins;
  }
  
  const thirdOfNightStartMins = (fajrMins - (nightTotalMins / 3) + 1440) % 1440;
  const thirdOfNightStr = minutesToTimeString(thirdOfNightStartMins);

  return {
    ...times,
    thirdOfNight: thirdOfNightStr,
    calculationDate: date.toDateString()
  };
}

export function timeToMinutes(str: string): number {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeString(mins: number): string {
  const hr = Math.floor(mins / 60) % 24;
  const mn = Math.round(mins % 60);
  return `${hr.toString().padStart(2, "0")}:${mn.toString().padStart(2, "0")}`;
}

/**
 * Compares two hours e.g. "18:30" vs "19:00"
 */
export function getRemainingTime(targetTime: string): { hours: number; minutes: number; totalMinutes: number } {
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = timeToMinutes(targetTime);

  let difference = targetMins - currentMins;
  if (difference < 0) {
    difference += 1440; // wrap around tomorrow
  }

  return {
    hours: Math.floor(difference / 60),
    minutes: difference % 60,
    totalMinutes: difference
  };
}
