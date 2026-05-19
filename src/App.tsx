import { useState, useEffect, useRef } from "react";
import { getHijriDate, getUpcomingFastingDays, getFastingStatus, type FastingDay, type HijriDate } from "./utils/hijri";
import { calculatePrayerTimes, getRemainingTime, timeToMinutes, DEFAULT_CONFIG, type PrayerTimeConfig, type PrayerTimes } from "./utils/prayerTimes";
import { ANDROID_FILES, type KotlinFile } from "./utils/androidExport";
import { 
  Bell, BellOff, Compass, MapPin, Heart, BookOpen, Volume2, VolumeX, Moon, Sun, 
  RotateCcw, History, Sparkles, Check, Settings, Code, Info, Download, Trash, Award, 
  Map, AlertCircle, RefreshCw, Calendar, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Predefined list of popular Arabic Islamic cities for quick offline selection
const POPULAR_CITIES = [
  { name: "مكة المكرمة", lat: 21.3891, lng: 39.8579, tz: 3 },
  { name: "الرياض", lat: 24.7136, lng: 46.6753, tz: 3 },
  { name: "القاهرة", lat: 30.0444, lng: 31.2357, tz: 2 },
  { name: "القدس الشريف", lat: 31.7683, lng: 35.2137, tz: 2 },
  { name: "عمّان", lat: 31.9454, lng: 35.9284, tz: 2 },
  { name: "بغداد", lat: 33.3152, lng: 44.3661, tz: 3 },
  { name: "الدار البيضاء", lat: 33.5731, lng: -7.5898, tz: 1 },
  { name: "المدينة المنورة", lat: 24.4672, lng: 39.6111, tz: 3 },
  { name: "دبي", lat: 25.2048, lng: 55.2708, tz: 4 },
  { name: "الكويت", lat: 29.3759, lng: 47.9774, tz: 3 },
  { name: "مسقط", lat: 23.5859, lng: 58.4059, tz: 4 }
];

export default function App() {
  // General System State
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeTab, setActiveTab] = useState<"home" | "fasting" | "tasbih" | "android" | "settings">("home");

  // Geolocation & Prayer Options
  const [cityName, setCityName] = useState("الرياض (تلقائي)");
  const [manualCityIndex, setManualCityIndex] = useState(1); // Riyadh as default
  const [config, setConfig] = useState<PrayerTimeConfig>({
    ...DEFAULT_CONFIG,
    offsets: { fajr: 0, shuruq: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
  });

  // Fasting Toggles
  const [fastingSettings, setFastingSettings] = useState({
    mondayThursday: true,
    whiteDays: true,
    dhulHijjah: true
  });

  // Sound/Athan Alert state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Digital Tasbih (Sebha) State
  const [selectedDhikr, setSelectedDhikr] = useState("سبحان الله");
  const [tasbihValue, setTasbihValue] = useState(0);
  const [tasbihTarget, setTasbihTarget] = useState(33);
  const [customCounterHistory, setCustomCounterHistory] = useState<{ text: string, count: number, date: string }[]>([]);

  // Local Time tracking
  const [currentTime, setCurrentTime] = useState(new Date());

  // Code Explorer State
  const [activeCodeFile, setActiveCodeFile] = useState<KotlinFile>(ANDROID_FILES[0]);

  // Read saved settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("islamic_theme");
    if (savedTheme) setTheme(savedTheme as any);

    const savedFasting = localStorage.getItem("fasting_settings");
    if (savedFasting) setFastingSettings(JSON.parse(savedFasting));

    const savedTasbihHistory = localStorage.getItem("tasbih_history");
    if (savedTasbihHistory) setCustomCounterHistory(JSON.parse(savedTasbihHistory));

    const savedConfig = localStorage.getItem("prayer_config");
    if (savedConfig) setConfig(JSON.parse(savedConfig));

    const savedCity = localStorage.getItem("city_name");
    if (savedCity) setCityName(savedCity);
  }, []);

  // Sync state helpers
  const saveFastingSettings = (updated: typeof fastingSettings) => {
    setFastingSettings(updated);
    localStorage.setItem("fasting_settings", JSON.stringify(updated));
  };

  const savePrayerConfig = (updated: PrayerTimeConfig) => {
    setConfig(updated);
    localStorage.setItem("prayer_config", JSON.stringify(updated));
  };

  // Clock tick effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Request user geolocation API
  const handleAutoLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(4));
          const lng = parseFloat(position.coords.longitude.toFixed(4));
          const updated = {
            ...config,
            latitude: lat,
            longitude: lng,
            timezone: 3 // Default Arab Standard Time zone (user can adjust)
          };
          savePrayerConfig(updated);
          setCityName("الموقع الفعلي (تلقائي)");
          localStorage.setItem("city_name", "الموقع الفعلي (تلقائي)");
          alert("تم تحديد إحداثيات موقعك بدقة وحساب مواقيت الصلاة تِبعاً لها!");
        },
        (error) => {
          alert("تعذر الحصول على الموقع تلقائياً. يرجى اختيار مدينتك يدوياً من قائمة الإعدادات.");
        }
      );
    } else {
      alert("ميزة تحديد الموقع غير مدعومة في متصفحك الحالي.");
    }
  };

  const handleManualCityChange = (index: number) => {
    setManualCityIndex(index);
    const selected = POPULAR_CITIES[index];
    const updated = {
      ...config,
      latitude: selected.lat,
      longitude: selected.lng,
      timezone: selected.tz
    };
    savePrayerConfig(updated);
    setCityName(selected.name);
    localStorage.setItem("city_name", selected.name);
  };

  // Perform Hijri conversions and Prayer Time computations
  const currentHijri = getHijriDate(currentTime);
  const prayerTimes = calculatePrayerTimes(currentTime, config);

  // Determine next upcoming prayer
  const getNextPrayer = (): { name: string; labelEn: string; time: string; remainingText: string } => {
    const list = [
      { name: "الفجر", key: "fajr", time: prayerTimes.fajr },
      { name: "الشروق", key: "shuruq", time: prayerTimes.shuruq },
      { name: "الظهر", key: "dhuhr", time: prayerTimes.dhuhr },
      { name: "العصر", key: "asr", time: prayerTimes.asr },
      { name: "المغرب", key: "maghrib", time: prayerTimes.maghrib },
      { name: "العشاء", key: "isha", time: prayerTimes.isha },
      { name: "قيام الليل", key: "thirdOfNight", time: prayerTimes.thirdOfNight }
    ];

    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    // Sort chronologically from now
    let next = list.find((item) => {
      const itemMins = timeToMinutes(item.time);
      return itemMins > nowMins;
    });

    if (!next) {
      next = list[0]; // Wrap around to tomorrow's Fajr
    }

    const { hours, minutes } = getRemainingTime(next.time);
    const remainingText = hours > 0 
      ? `باقي ${hours} ساعة و ${minutes} دقيقة` 
      : `باقي ${minutes} دقيقة فقط`;

    return {
      name: next.name,
      labelEn: next.key,
      time: next.time,
      remainingText
    };
  };

  const nextPrayer = getNextPrayer();
  const todayFastingStatus = getFastingStatus(currentTime, fastingSettings);
  const upcomingFastingList = getUpcomingFastingDays(fastingSettings, 15);

  // Digital Tasbih (Sebha) incrementor
  const handleTasbihIncrement = () => {
    const nextVal = tasbihValue + 1;
    setTasbihValue(nextVal);

    // Vibration feedback
    if ("vibrate" in navigator) {
      navigator.vibrate(25);
    }

    // Auto save session when target achieved
    if (nextVal >= tasbihTarget) {
      handleSaveTasbihSession(nextVal);
      setTasbihValue(0);
      alert(`ما شاء الله! أنجزت هدف التسبيح: ${tasbihTarget} من ذِكر: ${selectedDhikr}`);
    }
  };

  const handleSaveTasbihSession = (countVal: number = tasbihValue) => {
    if (countVal === 0) return;
    const item = {
      text: selectedDhikr,
      count: countVal,
      date: new Date().toLocaleDateString("ar-EG", { weekday: 'long', hour: '2-digit', minute: '2-digit' })
    };
    const updated = [item, ...customCounterHistory].slice(0, 10);
    setCustomCounterHistory(updated);
    localStorage.setItem("tasbih_history", JSON.stringify(updated));
    if (countVal === tasbihValue) {
      setTasbihValue(0);
    }
  };

  const handleClearTasbihHistory = () => {
    setCustomCounterHistory([]);
    localStorage.removeItem("tasbih_history");
  };

  // Helper to copy files quickly
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("تم نسخ الكود المصدري بنجاح!");
  };

  return (
    <div dir="rtl" className={`min-h-screen font-sans transition-colors duration-300 ${
      theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-neutral-50 text-slate-800"
    }`}>
      
      {/* HEADER SECTION */}
      <nav className={`sticky top-0 z-50 px-4 py-3 border-b transition-colors ${
        theme === "dark" ? "bg-slate-900/95 border-emerald-950/40" : "bg-white/95 border-emerald-100/55"
      } backdrop-blur-md`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-500 shadow-inner">
              <Compass className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-emerald-500">تذكير الصيام والعبادة</h1>
              <p className="text-xs opacity-60">تطبيق العبادات والتقويم الهجري الشامل</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Dark & Light toggler */}
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`p-2 rounded-xl border transition-all ${
                theme === "dark" ? "bg-slate-800 border-slate-705 text-amber-400" : "bg-white border-slate-200 text-slate-600"
              }`}
              title="تغيير المظهر"
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Simulated Notification Toggler */}
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`p-2 rounded-xl border transition-all ${
                notificationsEnabled 
                  ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-500" 
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}
              title="حالة التذكيرات والإشعارات"
            >
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* QUICK STATUS BAR */}
      <div className={`p-4 border-b ${
        theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-emerald-50/40 border-slate-100"
      }`}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-emerald-500" />
            <div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                اليوم: {currentHijri.formatted}
              </div>
              <div className="text-xs opacity-60">
                الموافق: {currentTime.toLocaleDateString("ar-EG", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {cityName}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        
        {/* TAB CONTROLS */}
        <div className="grid grid-cols-5 gap-1.5 mb-6 bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border dark:border-slate-800">
          {[
            { id: "home", label: "الرئيسية", icon: Compass },
            { id: "fasting", label: "الصيام", icon: Heart },
            { id: "tasbih", label: "السبحة", icon: Sparkles },
            { id: "android", label: "كود أندرويد", icon: Code },
            { id: "settings", label: "الإعدادات", icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-1 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  active 
                    ? "bg-emerald-600 text-white shadow-md font-bold" 
                    : "text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/5"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TABS VIEWPORT */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            
            {/* TAB 1: HOME PANEL */}
            {activeTab === "home" && (
              <div className="space-y-6">
                
                {/* 1. NEXT PRAYER HERO BANNER */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-6 md:p-8 shadow-xl border border-emerald-500/20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -z-0 pointer-events-none" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <span className="bg-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md uppercase text-emerald-200">
                        الصلاة القادمة
                      </span>
                      <h2 className="text-4xl font-extrabold mt-3 tracking-tight">{nextPrayer.name}</h2>
                      <p className="text-3xl font-mono font-medium mt-1 text-emerald-100">{nextPrayer.time}</p>
                      <p className="text-sm mt-2 opacity-90 flex items-center gap-1.5 bg-emerald-950/20 px-3 py-1 rounded-xl w-fit">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {nextPrayer.remainingText}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-emerald-950/20 p-4 rounded-2xl backdrop-blur-md border border-emerald-500/20 text-right">
                      <div>
                        <span className="text-xs text-emerald-200 block">ثلث الليل الأخير يبدأ</span>
                        <span className="text-lg font-mono font-bold text-white block mt-0.5">{prayerTimes.thirdOfNight}</span>
                      </div>
                      <div>
                        <span className="text-xs text-emerald-200 block">شروق الشمس</span>
                        <span className="text-lg font-mono font-bold text-white block mt-0.5">{prayerTimes.shuruq}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TODAY FASTING MINI CARD */}
                {todayFastingStatus.isFasting ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <span className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                      <Heart className="w-6 h-6 animate-pulse" />
                    </span>
                    <div>
                      <h3 className="font-bold text-amber-500">تقبل الله صيامك!</h3>
                      <p className="text-xs opacity-75 mt-0.5">اليوم مستحب الصيام: {todayFastingStatus.titleAr}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-center gap-3">
                    <span className="p-3 bg-emerald-600/10 text-emerald-500 rounded-xl">
                      <Sparkles className="w-6 h-6" />
                    </span>
                    <div>
                      <h3 className="font-bold text-emerald-600 dark:text-emerald-400">اليوم ليس من أيام الصيام المستحب</h3>
                      <p className="text-xs opacity-75 mt-0.5">يمكنك تصفّح جدول الصيام لمشاهدة الأيام المباركة القادمة ونيل الأجر.</p>
                    </div>
                  </div>
                )}

                {/* 2. PRAYER TIMES LIST */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Compass className="w-5 h-5 text-emerald-500" />
                      مواقيت الصلاة اليومية
                    </h3>
                    <span className="text-xs text-emerald-500 cursor-pointer hover:underline" onClick={() => setActiveTab("settings")}>
                      تعديل طريقة الحساب ←
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { name: "الفجر", key: "fajr", time: prayerTimes.fajr, icon: "🌅" },
                      { name: "الشروق", key: "shuruq", time: prayerTimes.shuruq, icon: "☀️" },
                      { name: "الظهر", key: "dhuhr", time: prayerTimes.dhuhr, icon: "🌤️" },
                      { name: "العصر", key: "asr", time: prayerTimes.asr, icon: "⛅" },
                      { name: "المغرب", key: "maghrib", time: prayerTimes.maghrib, icon: "🌇" },
                      { name: "العشاء", key: "isha", time: prayerTimes.isha, icon: "🌃" }
                    ].map((pVal) => {
                      const isActive = nextPrayer.labelEn === pVal.key;
                      return (
                        <div key={pVal.key} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          isActive 
                            ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/5 scale-[1.02] shadow-sm shadow-emerald-500/10" 
                            : theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{pVal.icon}</span>
                            <span className="text-xs font-semibold py-0.5 px-2 bg-slate-500/10 rounded-full">صلاة</span>
                          </div>
                          <div className="mt-4">
                            <span className="text-xs opacity-60 block">{pVal.name}</span>
                            <span className="text-xl font-mono font-bold text-emerald-500">{pVal.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* QIYAM BANNER */}
                <div className={`p-5 rounded-2xl border transition-all ${
                  theme === "dark" ? "bg-indigo-950/10 border-indigo-500/20" : "bg-indigo-500/5 border-indigo-200"
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-500/15 text-indigo-500 rounded-xl">
                      <Moon className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-500 text-base">قيام الليل شرف المؤمن</h3>
                      <p className="text-sm opacity-85 mt-1 leading-relaxed">
                        يبدأ ثلث الليل الأخير بتوقيت الرياض في تمام الساعة <strong className="font-mono text-emerald-500">{prayerTimes.thirdOfNight}</strong> بالتوقيت المحلي. 
                        وهو وقت النزول الإلهي وموطن إجابة الدعاء.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: FASTING PAGE */}
            {activeTab === "fasting" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Heart className="w-6 h-6 text-rose-500 animate-pulse" />
                    جدول الصيام المستحب القادم
                  </h2>
                  <p className="text-sm opacity-60 mt-1">قائمة بالأيام المستحب صيامها خلال الـ 15 يوماً القادمة حسب التقويم الهجري والميلادي.</p>
                </div>

                {/* FASTING ALERTS FAST SWITCHES */}
                <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border ${
                  theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                }`}>
                  <div className="flex items-center justify-between p-2">
                    <label className="text-sm font-semibold">صيام الإثنين والخميس</label>
                    <input 
                      type="checkbox" 
                      className="accent-emerald-500 h-5 w-5 rounded" 
                      checked={fastingSettings.mondayThursday}
                      onChange={(e) => saveFastingSettings({ ...fastingSettings, mondayThursday: e.target.checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <label className="text-sm font-semibold">صيام الأيام البيض (13-15)</label>
                    <input 
                      type="checkbox" 
                      className="accent-emerald-500 h-5 w-5 rounded" 
                      checked={fastingSettings.whiteDays}
                      onChange={(e) => saveFastingSettings({ ...fastingSettings, whiteDays: e.target.checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <label className="text-sm font-semibold">صيام ذي الحجة وعرفة</label>
                    <input 
                      type="checkbox" 
                      className="accent-emerald-500 h-5 w-5 rounded" 
                      checked={fastingSettings.dhulHijjah}
                      onChange={(e) => saveFastingSettings({ ...fastingSettings, dhulHijjah: e.target.checked })}
                    />
                  </div>
                </div>

                {/* FASTING DAYS TABLE LIST */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-slate-500 dark:text-emerald-400 text-sm tracking-wider uppercase">الأيام المكتشفة القادمة</h3>
                  
                  {upcomingFastingList.length === 0 ? (
                    <div className="text-center py-10 opacity-60 border border-dashed rounded-2xl">
                      يرجى تفعيل أحد خيارات التذكير بالصيام أعلاه لإظهار المواعيد
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingFastingList.map((day, idx) => {
                        const isArafah = day.type === "arafah";
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            isArafah 
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                              : theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{isArafah ? "🏆" : "🌙"}</span>
                              <div>
                                <h4 className="font-bold text-sm block">{day.titleAr}</h4>
                                <span className="text-xs opacity-60 mt-0.5">
                                  {day.hijriDate.day} {day.hijriDate.monthName} {day.hijriDate.year} هـ
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-sm block">
                                {day.date.toLocaleDateString("ar-EG", { weekday: 'long', month: '2-digit', day: '2-digit' })}
                              </span>
                              <span className="text-[10px] uppercase tracking-wide bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                                صيام سنّة
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOM DIGITAL TASBIH */}
            {activeTab === "tasbih" && (
              <div className="space-y-6">
                <div className="text-center max-w-md mx-auto">
                  <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-500 animate-spin" style={{ animationDuration: "12s" }} />
                    السبحة الرقمية الذكية
                  </h2>
                  <p className="text-xs opacity-60 mt-1">تتبع تسبيحك اليومي بسهولة. سيهتز الجهاز عند الضغط وإتمام الدورة بنجاح.</p>
                </div>

                {/* THE MAIN DIGIT CLICKER */}
                <div className="max-w-md mx-auto bg-slate-900 ring-2 ring-emerald-500/30 text-white rounded-3xl p-6 shadow-xl flex flex-col items-center">
                  
                  {/* Selected Dhikr Selector */}
                  <div className="w-full mb-4">
                    <label className="text-xs text-emerald-400 block text-right mb-1">الذِكر الحالي</label>
                    <select 
                      value={selectedDhikr} 
                      onChange={(e) => {
                        setSelectedDhikr(e.target.value);
                        setTasbihValue(0);
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-800 border-none text-white text-sm focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="سبحان الله">سبحان الله</option>
                      <option value="الحمد لله">الحمد لله</option>
                      <option value="لا إله إلا الله">لا إله إلا الله</option>
                      <option value="الله أكبر">الله أكبر</option>
                      <option value="أستغفر الله">أستغفر الله</option>
                      <option value="اللهم صل وسلم على نبينا محمد">اللهم صل وسلم على نبينا محمد</option>
                    </select>
                  </div>

                  {/* PRESET TARGETS */}
                  <div className="flex gap-2 mb-6 justify-center w-full">
                    {[33, 99, 100, 1000].map((t) => (
                      <button 
                        key={t}
                        onClick={() => {
                          setTasbihTarget(t);
                          setTasbihValue(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold transition-all cursor-pointer ${
                          tasbihTarget === t 
                            ? "bg-emerald-600 text-white" 
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* LARGE BUTTON CIRCLE */}
                  <div 
                    onClick={handleTasbihIncrement}
                    className="relative w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 border-4 border-emerald-900/50 shadow-2xl flex flex-col items-center justify-center cursor-pointer active:scale-95 duration-200 select-none group"
                  >
                    <span className="text-5xl font-mono font-black select-none">{tasbihValue}</span>
                    <span className="text-xs text-emerald-100 uppercase tracking-widest mt-2 block select-none">اضغط للتسبيح</span>
                    {/* Ring outer effect */}
                    <div className="absolute inset-2 border border-dashed border-emerald-300/30 rounded-full animate-spin" style={{ animationDuration: '30s' }} />
                  </div>

                  {/* PROGRESS TEXT */}
                  <div className="w-full mt-6 flex justify-between items-center px-2">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">الهدف الكلي</span>
                      <span className="text-sm font-bold text-white block mt-0.5">{tasbihTarget}</span>
                    </div>
                    <div className="text-center flex gap-1.5">
                      <button 
                        onClick={() => handleSaveTasbihSession()} 
                        className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                        title="حفظ جلسة التسبيح الحالية"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("هل متأكد من تصفير العداد؟")) setTasbihValue(0);
                        }}
                        className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all cursor-pointer"
                        title="تصفير"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SESSIONS HISTORY LOG */}
                <div className="max-w-md mx-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm flex items-center gap-1">
                      <History className="w-4 h-4" />
                      سِجل الجلسات المحفوظة
                    </h3>
                    {customCounterHistory.length > 0 && (
                      <button onClick={handleClearTasbihHistory} className="text-xs text-rose-500 flex items-center gap-1 hover:underline cursor-pointer">
                        <Trash className="w-3.5 h-3.5" /> مسح السجل
                      </button>
                    )}
                  </div>

                  {customCounterHistory.length === 0 ? (
                    <div className="text-center py-8 border rounded-2xl opacity-60 text-xs border-dashed">
                      لم تحفظ أي جلسة تسبيح بعد. سيتم توثيق جلساتك هنا تلقائياً عند بلوغ الهدف.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customCounterHistory.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                        }`}>
                          <div>
                            <span className="font-bold text-sm block">{item.text}</span>
                            <span className="text-[10px] opacity-50 block mt-0.5">{item.date}</span>
                          </div>
                          <span className="font-mono bg-emerald-500/10 text-emerald-500 font-bold px-2.5 py-1 rounded-full text-xs">
                            {item.count} مرّة
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: ANDROID SOURCE CODE EXPLORER */}
            {activeTab === "android" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Code className="w-6 h-6 text-emerald-500 animate-pulse" />
                    مستكشف كود أندرويد Kotlin
                  </h2>
                  <p className="text-sm opacity-60 mt-1">
                    هذا الكود مصمم وفق معايير جوجل ليعمل على نظام أندرويد 8 وما بعده بشكل مثالي. وبإطار عمل <strong>Compose + MVVM + Local DB + Background WorkManager</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* File sidebar list */}
                  <div className="md:col-span-1 space-y-1.5">
                    {ANDROID_FILES.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveCodeFile(file)}
                        className={`w-full p-2.5 rounded-xl text-right text-xs transition-all flex items-center justify-between cursor-pointer ${
                          activeCodeFile.name === file.name 
                            ? "bg-emerald-600 text-white shadow-md font-bold" 
                            : "bg-slate-500/5 hover:bg-slate-500/10"
                        }`}
                      >
                        <span className="truncate">{file.name}</span>
                        <span className="text-[9px] uppercase tracking-wide opacity-65 flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" /> {file.category}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Raw script display */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-400">{activeCodeFile.path}</span>
                      <button 
                        onClick={() => copyToClipboard(activeCodeFile.code)}
                        className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-xl hover:bg-emerald-500 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> نسخ الكود
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto h-[400px]">
                      <code>{activeCodeFile.code}</code>
                    </pre>

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed text-amber-500">
                      <strong>💡 طريقة استخدام هذا الكود:</strong> قم بإنشاء مشروع Android Studio جديد، ثم الصق كود الملفات في المجلدات المذكورة في الجزء العلوي لكل ملف. سيقوم التطبيق بالبناء والحفظ والعمل تلقائياً.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SETTINGS */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="w-6 h-6 text-emerald-500" />
                    إعدادات التقويم والموقع
                  </h2>
                  <p className="text-sm opacity-60 mt-1">تحكم بطريقة حساب الصلاة وتخصيص الموقع يدويًا أو عبر GPS.</p>
                </div>

                {/* Calculation method selector */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                }`}>
                  <div>
                    <label className="text-sm font-bold block mb-1">طريقة الحساب المعتمدة لعمق الشمس</label>
                    <select
                      value={config.method}
                      onChange={(e) => savePrayerConfig({ ...config, method: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl bg-slate-500/10 border-none text-sm transition-all focus:ring-1 focus:ring-emerald-500 cursor-pointer text-slate-800 dark:text-neutral-100 dark:bg-slate-800"
                    >
                      <option value="UMM_AL_QURA">أم القرى (المملكة العربية السعودية)</option>
                      <option value="EGYPTIAN">الهيئة المصرية العامة للمساحة</option>
                      <option value="MWL">رابطة العالم الإسلامي</option>
                      <option value="ISNA">الجمعية الإسلامية لأمريكا الشمالية</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-bold block mb-1">المنطقة الزمنية (Offset)</label>
                    <input 
                      type="number" 
                      value={config.timezone}
                      onChange={(e) => savePrayerConfig({ ...config, timezone: parseFloat(e.target.value) || 3 })}
                      className="w-full p-2.5 rounded-xl bg-slate-500/10 border-none text-sm focus:ring-1 text-slate-800 dark:text-neutral-100 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Manual Location Selection */}
                <div className={`p-4 rounded-2xl border space-y-4 ${
                  theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                }`}>
                  <div>
                    <h3 className="text-sm font-bold block mb-1">خيارات تحديد موقعك الجغرافي</h3>
                    <p className="text-xs opacity-60 mb-3">حسابات دقيقة بحسب إحداثيات خطوط الطول والعرض للبلد لتجنب الفوارق الزمنية.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button 
                        onClick={handleAutoLocation}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-500 cursor-pointer"
                      >
                        <MapPin className="w-4 h-4" /> تحديد تلقائي عبر المتصفح (GPS)
                      </button>

                      <select
                        onChange={(e) => handleManualCityChange(parseInt(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-500/10 border-none text-sm focus:ring-1 text-slate-800 dark:text-neutral-100 dark:bg-slate-800 cursor-pointer"
                      >
                        {POPULAR_CITIES.map((city, idx) => (
                          <option key={idx} value={idx}>{city.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-500/5 p-3 rounded-xl border border-dashed dark:border-slate-800 text-xs">
                    <div>
                      <span className="opacity-60 block">خط العرض (Latitude)</span>
                      <strong className="font-mono mt-0.5 block">{config.latitude}</strong>
                    </div>
                    <div>
                      <span className="opacity-60 block">خط الطول (Longitude)</span>
                      <strong className="font-mono mt-0.5 block">{config.longitude}</strong>
                    </div>
                  </div>
                </div>

                {/* Minute Offsets Fine Tuning */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                }`}>
                  <h3 className="text-sm font-bold block">الفوارق الدقيقة لأوقات الصلاة (بالدقائق)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "الفجر", key: "fajr" },
                      { label: "الشروق", key: "shuruq" },
                      { label: "الظهر", key: "dhuhr" },
                      { label: "العصر", key: "asr" },
                      { label: "المغرب", key: "maghrib" },
                      { label: "العشاء", key: "isha" }
                    ].map((p, idx) => (
                      <div key={idx} className="bg-slate-500/5 p-2 rounded-xl text-center">
                        <span className="text-xs opacity-60 block">{p.label}</span>
                        <input 
                          type="number" 
                          value={(config.offsets as any)[p.key]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const offsets = { ...config.offsets, [p.key]: val };
                            savePrayerConfig({ ...config, offsets });
                          }}
                          className="w-16 text-center font-mono mt-1 font-bold bg-slate-500/10 rounded-md p-1 focus:ring-1 text-slate-800 dark:text-neutral-100 dark:bg-slate-800"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer / App Info */}
                <div className="text-center py-6 opacity-60 space-y-1">
                  <p className="text-xs">تطبيق تذكير الصيام والعبادات يعمل بشكل ذاتي ودون شروط اتصال بالشبكة.</p>
                  <p className="text-[10px] font-mono leading-none">&copy; 2026 جميع الحقوق محفوظة لخدمة التذكير والذكرى</p>
                </div>

              </div>
            )}

          </motion.div>
        </AnimatePresence>

      </main>

    </div>
  );
}
