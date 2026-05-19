/**
 * Hijri Date Utilities & KUWAITI Algorithm
 */

export interface HijriDate {
  day: number;
  month: number; // 1-12
  year: number;
  monthName: string;
  formatted: string;
}

const HIJRI_MONTH_NAMES_AR = [
  "المحرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوّال",
  "ذو القعدة",
  "ذو الحجة"
];

const HIJRI_MONTH_NAMES_EN = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qadah",
  "Dhu al-Hijjah"
];

/**
 * Converts Gregorian date to Hijri date
 */
export function getHijriDate(gregorianDate: Date): HijriDate {
  let date = new Date(gregorianDate);
  let day = date.getDate();
  let month = date.getMonth(); // 0-11
  let year = date.getFullYear();

  let jd = 0;
  if (year > 1582 || (year === 1582 && month > 9) || (year === 1582 && month === 9 && day >= 15)) {
    // Gregorian calendar
    let alpha = Math.floor((year - 1600) / 100);
    let beta = Math.floor((alpha) / 4);
    jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 2)) + day + 2 - alpha + beta - 1524.5;
  } else {
    // Julian calendar
    jd = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 2)) + day - 1524.5;
  }

  // Adjust for Julian Date
  let b = 0;
  let c = Math.floor(jd + 0.5) + 2921940;
  let d = Math.floor((c - 1) / 10631);
  let e = c - 10631 * d;
  let f = Math.floor((e - 1) / 354);
  let g = e - Math.floor(354 * f + 0.5);
  
  // Leap year calculation & month calculation
  let h = Math.floor((11 * f + 3) / 30);
  let j = f + 1;
  let i = g - Math.floor(29.5001 * j + 0.5) + h;

  let hMonth = j;
  let hDay = i;
  let hYear = d * 30 + f + 1;

  // Manual corrections based on standard behavior if any adjustments are simulated
  if (hDay <= 0) {
    hMonth -= 1;
    if (hMonth === 0) {
      hMonth = 12;
      hYear -= 1;
    }
    hDay += 30; // Approximation
  } else if (hDay > 30) {
    hDay -= 30;
    hMonth += 1;
    if (hMonth > 12) {
      hMonth = 1;
      hYear += 1;
    }
  }

  const monthIndex = (hMonth - 1 + 12) % 12;
  const monthName = HIJRI_MONTH_NAMES_AR[monthIndex];

  return {
    day: hDay,
    month: hMonth,
    year: hYear,
    monthName,
    formatted: `${hDay} ${monthName} ${hYear} هـ`
  };
}

export interface FastingDay {
  date: Date;
  hijriDate: HijriDate;
  type: "monday" | "thursday" | "white_day" | "dhul_hijjah_9" | "arafah" | "none";
  titleAr: string;
  isFasting: boolean;
}

/**
 * Checks if a specific day is recommended for fasting
 */
export function getFastingStatus(date: Date, settings: { mondayThursday: boolean; whiteDays: boolean; dhulHijjah: boolean }): FastingDay {
  const hDate = getHijriDate(date);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday

  // Eid Al-Adha is on 10 Dhu al-Hijjah - fasting is strictly forbidden (Haram)
  if (hDate.month === 12 && hDate.day === 10) {
    return {
      date,
      hijriDate: hDate,
      type: "none",
      titleAr: "عيد الأضحى المبارك (يُحرم الصيام)",
      isFasting: false
    };
  }

  // 1. Arafah & 9 days of Dhu al-Hijjah
  if (settings.dhulHijjah && hDate.month === 12 && hDate.day >= 1 && hDate.day <= 9) {
    if (hDate.day === 9) {
      return {
        date,
        hijriDate: hDate,
        type: "arafah",
        titleAr: "يوم عرفة (يكفر سنة ماضية وسنة باقية)",
        isFasting: true
      };
    }
    return {
      date,
      hijriDate: hDate,
      type: "dhul_hijjah_9",
      titleAr: `صيام ${hDate.day} ذي الحجة`,
      isFasting: true
    };
  }

  // 2. White Days (الأيام البيض): 13, 14, 15
  if (settings.whiteDays && (hDate.day === 13 || hDate.day === 14 || hDate.day === 15)) {
    // Ramadan is already fully fasted, but in other months it's sunnah
    return {
      date,
      hijriDate: hDate,
      type: "white_day",
      titleAr: `الأيام البيض (${hDate.day} ${hDate.monthName})`,
      isFasting: true
    };
  }

  // 3. Monday (الإثنين) and Thursday (الخميس)
  if (settings.mondayThursday) {
    if (dayOfWeek === 1) {
      return {
        date,
        hijriDate: hDate,
        type: "monday",
        titleAr: "صيام الإثنين (ترفع فيه الأعمال)",
        isFasting: true
      };
    }
    if (dayOfWeek === 4) {
      return {
        date,
        hijriDate: hDate,
        type: "thursday",
        titleAr: "صيام الخميس (ترفع فيه الأعمال)",
        isFasting: true
      };
    }
  }

  return {
    date,
    hijriDate: hDate,
    type: "none",
    titleAr: "",
    isFasting: false
  };
}

/**
 * Gets lists of upcoming fasting days (next 30 days)
 */
export function getUpcomingFastingDays(settings: { mondayThursday: boolean; whiteDays: boolean; dhulHijjah: boolean }, daysCount = 30): FastingDay[] {
  const list: FastingDay[] = [];
  const today = new Date();
  
  for (let i = 0; i < daysCount; i++) {
    const current = new Date(today);
    current.setDate(today.getDate() + i);
    const status = getFastingStatus(current, settings);
    if (status.isFasting) {
      list.push(status);
    }
  }
  return list;
}
