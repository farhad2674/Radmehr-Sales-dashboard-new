import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  Search, 
  TrendingUp, 
  Wallet, 
  AlertTriangle, 
  CheckCircle, 
  Calendar, 
  User,
  Filter,
  BrainCircuit,
  Sparkles,
  Loader2,
  ChevronDown,
  X,
  BarChart3
} from 'lucide-react';
import { Cheque, MonthlyStats, RawChequeData, AnomalyReport } from './types';
import { normalizeChequeData, getCurrentJalaliDate, formatCurrency, toPersianDigits } from './utils/helpers';
import StatsWidget from './components/StatsWidget';
import { LiquidityChart, CountChart } from './components/Charts';

const PERSIAN_MONTHS = [
  { value: '01', label: 'فروردین' },
  { value: '02', label: 'اردیبهشت' },
  { value: '03', label: 'خرداد' },
  { value: '04', label: 'تیر' },
  { value: '05', label: 'مرداد' },
  { value: '06', label: 'شهریور' },
  { value: '07', label: 'مهر' },
  { value: '08', label: 'آبان' },
  { value: '09', label: 'آذر' },
  { value: '10', label: 'دی' },
  { value: '11', label: 'بهمن' },
  { value: '12', label: 'اسفند' },
];

function App() {
  const [data, setData] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUser, setFilterUser] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentDate] = useState(getCurrentJalaliDate()); // Default "Now"
  
  // Table Specific Filters
  const [tableYear, setTableYear] = useState<string>('all');
  const [tableMonth, setTableMonth] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Chart Range Filter
  const [chartRange, setChartRange] = useState<number>(9);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close filter popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // --- Excel Import Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const startTime = Date.now();

    // Use setTimeout to allow the UI to render the loading state first
    // before the main thread gets blocked by XLSX processing
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json<RawChequeData>(ws);

          const normalized = jsonData
            .map((row, index) => normalizeChequeData(row, index))
            .filter((item): item is Cheque => item !== null);

          // Calculate how much time passed
          const elapsed = Date.now() - startTime;
          const MIN_LOADING_TIME = 3000; // 3 seconds
          const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsed);

          // Wait for the remaining time to ensure the animation plays
          setTimeout(() => {
            setData(normalized);
            setLoading(false);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }, remainingTime);

        } catch (error) {
          console.error("Error processing file:", error);
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    }, 100);
  };

  // --- Autocomplete Logic ---
  const uniqueNames = useMemo(() => {
    // Extract all unique names from the dataset for suggestions
    const names = new Set(data.map(item => item.receivedFrom));
    return Array.from(names).filter(Boolean).sort();
  }, [data]);

  const suggestions = useMemo(() => {
    if (!filterUser.trim()) return [];
    return uniqueNames.filter(name => 
      name.toLowerCase().includes(filterUser.toLowerCase()) &&
      name !== filterUser
    ).slice(0, 6); // Limit to top 6 suggestions
  }, [uniqueNames, filterUser]);

  const handleSelectName = (name: string) => {
    setFilterUser(name);
    setShowSuggestions(false);
  };

  // --- Filtering Logic (Global) ---
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // 1. Filter by Date (Future only)
      const isFuture = item.dueDate >= currentDate;
      
      // 2. Filter by User Search
      const matchesUser = filterUser 
        ? item.receivedFrom.includes(filterUser) 
        : true;

      return isFuture && matchesUser;
    });
  }, [data, filterUser, currentDate]);

  const pastData = useMemo(() => {
      // Data used for normalization checks (history)
      return data.filter(item => item.dueDate < currentDate);
  }, [data, currentDate]);

  // --- Table Specific Filtering Logic ---
  const availableYears = useMemo(() => {
    const years = new Set(filteredData.map(d => d.dueDate.substring(0, 4)));
    return Array.from(years).sort();
  }, [filteredData]);

  const tableData = useMemo(() => {
    return filteredData.filter(item => {
        const y = item.dueDate.substring(0, 4);
        const m = item.dueDate.substring(5, 7);
        const matchYear = tableYear === 'all' || y === tableYear;
        const matchMonth = tableMonth === 'all' || m === tableMonth;
        return matchYear && matchMonth;
    });
  }, [filteredData, tableYear, tableMonth]);

  // Check if a specific month has data for the selected year
  const isMonthDisabled = (mVal: string) => {
    if (tableYear === 'all') {
        // If no year selected, check if this month exists in ANY available record
        return !filteredData.some(d => d.dueDate.substring(5, 7) === mVal);
    }
    // Check if this specific month exists in the selected year
    return !filteredData.some(d => d.dueDate.substring(0, 4) === tableYear && d.dueDate.substring(5, 7) === mVal);
  };

  // --- Analytics & Aggregation ---
  const analytics = useMemo(() => {
    const monthlyStatsMap = new Map<string, { amount: number; count: number }>();
    let totalFutureAmount = 0;
    let totalFutureCount = 0;
    const payerAmounts = new Map<string, number>();

    filteredData.forEach(item => {
      // Monthly Aggregation (YYYY/MM)
      const monthKey = item.dueDate.substring(0, 7); 
      const current = monthlyStatsMap.get(monthKey) || { amount: 0, count: 0 };
      
      monthlyStatsMap.set(monthKey, {
        amount: current.amount + item.amount,
        count: current.count + 1
      });

      // Total Totals
      totalFutureAmount += item.amount;
      totalFutureCount += 1;

      // Top Payer Calculation
      const currentPayerTotal = payerAmounts.get(item.receivedFrom) || 0;
      payerAmounts.set(item.receivedFrom, currentPayerTotal + item.amount);
    });

    // Convert Map to Array and Sort by Date
    const monthlyStats: MonthlyStats[] = Array.from(monthlyStatsMap.entries())
      .map(([month, stats]) => ({
        month,
        totalAmount: stats.amount,
        count: stats.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Find Top Payer
    let topPayer = { name: 'ندارد', amount: 0 };
    payerAmounts.forEach((amount, name) => {
      if (amount > topPayer.amount) {
        topPayer = { name, amount };
      }
    });

    return { monthlyStats, totalFutureAmount, totalFutureCount, topPayer };
  }, [filteredData]);

  // --- Chart Data Filtering ---
  const chartData = useMemo(() => {
    return analytics.monthlyStats.slice(0, chartRange);
  }, [analytics.monthlyStats, chartRange]);

  // --- Anomaly Detection ---
  const anomalyReport: AnomalyReport = useMemo(() => {
    if (pastData.length === 0 || filteredData.length === 0) {
      return { isNormal: true, averageMonthlyCount: 0, futureAvgCount: 0, details: "دیتای کافی نیست" };
    }

    // Calculate Past Average Count per Month
    const pastMonths = new Set(pastData.map(d => d.dueDate.substring(0, 7))).size;
    const avgPast = pastData.length / (pastMonths || 1);

    // Calculate Future Average Count per Month
    const futureMonths = analytics.monthlyStats.length;
    const avgFuture = filteredData.length / (futureMonths || 1);

    // Simple Threshold: If future density is > 1.5x past density
    const isHighVolume = avgFuture > (avgPast * 1.5);
    
    return {
      isNormal: !isHighVolume,
      averageMonthlyCount: Math.round(avgPast),
      futureAvgCount: Math.round(avgFuture),
      details: isHighVolume 
        ? `حجم چک‌های آتی (${toPersianDigits(Math.round(avgFuture))}) بسیار بیشتر از میانگین گذشته (${toPersianDigits(Math.round(avgPast))}) است.`
        : `روند چک‌ها نرمال است.`
    };
  }, [pastData, filteredData, analytics.monthlyStats.length]);


  return (
    <div className="min-h-screen pb-10">
      
      {/* AI Analysis Loading Screen */}
      {loading && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-500">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-emerald-500/30 blur-3xl rounded-full animate-pulse"></div>
            <div className="relative z-10 bg-slate-800 p-8 rounded-full border border-slate-700 shadow-2xl">
               <BrainCircuit size={80} className="text-emerald-400 animate-pulse" />
               <div className="absolute top-0 right-0 animate-bounce">
                  <Sparkles size={32} className="text-amber-400" />
               </div>
            </div>
            {/* Spinning ring */}
            <div className="absolute -inset-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
          
          <h2 className="text-3xl font-bold text-white tracking-wide mb-3 animate-pulse">
            هوش مصنوعی در حال تحلیل داده‌ها...
          </h2>
          <div className="flex items-center gap-2 text-emerald-400/80 font-mono text-sm">
            <Loader2 size={16} className="animate-spin" />
            <span>AI Processing Engine Active</span>
          </div>
          <p className="mt-4 text-slate-500 text-sm max-w-md text-center">
            در حال استخراج الگوهای مالی، بررسی وضعیت نقدینگی و شناسایی چک‌های آتی از فایل اکسل شما
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <TrendingUp className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              داشبورد مدیریت <span className="text-emerald-400">چک و نقدینگی</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud size={20} />
              <span>بارگذاری اکسل</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Empty State */}
        {data.length === 0 && !loading && (
           <div className="flex flex-col items-center justify-center h-[60vh] text-center border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20">
             <div className="bg-slate-800 p-6 rounded-full mb-4">
               <UploadCloud size={64} className="text-slate-500" />
             </div>
             <h2 className="text-2xl font-bold text-slate-300 mb-2">فایل اکسل خود را وارد کنید</h2>
             <p className="text-slate-400 max-w-md">
               برای مشاهده تحلیل‌ها، لیست چک‌ها و نمودارهای هوشمند، فایل داده‌های خود را بارگذاری کنید.
             </p>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="mt-6 text-emerald-400 font-bold hover:text-emerald-300 underline"
             >
               انتخاب فایل از سیستم
             </button>
           </div>
        )}

        {/* Dashboard Content */}
        {data.length > 0 && !loading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Filter Bar */}
            <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between z-40 relative">
              <div className="flex items-center gap-2 text-slate-400">
                <Filter size={20} />
                <span className="text-sm font-medium">فیلترهای پیشرفته:</span>
              </div>
              
              <div className="flex-1 min-w-[300px] relative group z-50">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="جستجو در نام طرف حساب (دریافت از)..."
                  value={filterUser}
                  onChange={(e) => {
                    setFilterUser(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 pr-10 pl-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5">
                    <ul className="max-h-60 overflow-y-auto py-1">
                      {suggestions.map((name, idx) => (
                        <li 
                          key={idx}
                          className="px-4 py-2.5 hover:bg-slate-700/50 cursor-pointer text-slate-300 hover:text-white transition-colors flex items-center gap-3 border-b border-slate-700/50 last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectName(name);
                          }}
                        >
                          <div className="bg-slate-700 p-1 rounded-md">
                            <User size={14} className="text-slate-400" />
                          </div>
                          <span>{name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm">
                مبنای محاسبه آینده: <span className="text-white font-mono font-bold">{toPersianDigits(currentDate)}</span>
              </div>
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsWidget 
                title="مجموع مبالغ آتی" 
                value={formatCurrency(analytics.totalFutureAmount)}
                subValue="تومان"
                icon={Wallet} 
                color="emerald" 
              />
              <StatsWidget 
                title="تعداد کل چک‌ها" 
                value={analytics.totalFutureCount} 
                subValue="فقره در آینده"
                icon={CheckCircle} 
                color="blue" 
              />
              <StatsWidget 
                title="بزرگترین پرداخت‌کننده" 
                value={analytics.topPayer.name} 
                subValue={`مبلغ: ${formatCurrency(analytics.topPayer.amount)}`}
                icon={User} 
                color="violet" 
              />
               <StatsWidget 
                title="وضعیت تراکم چک‌ها" 
                value={anomalyReport.isNormal ? "نرمال" : "تراکم بالا"} 
                subValue={anomalyReport.details}
                icon={anomalyReport.isNormal ? TrendingUp : AlertTriangle} 
                color={anomalyReport.isNormal ? "amber" : "rose"} 
              />
            </div>

            {/* Charts Section Header & Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 pb-2 border-b border-slate-800/50">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-blue-500" />
                تحلیل نموداری ماهانه
              </h3>
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-sm">
                {[2, 4, 6, 9].map(range => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      chartRange === range 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                  >
                    {toPersianDigits(range)} ماه آینده
                  </button>
                ))}
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LiquidityChart data={chartData} />
              <CountChart data={chartData} />
            </div>

            {/* Detailed List Section */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl shadow-xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center rounded-t-2xl bg-slate-800/40 relative">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="text-emerald-500" />
                    لیست چک‌های آینده
                    {filterUser && <span className="text-sm font-normal text-slate-400 mr-2">(فیلتر شده برای: {filterUser})</span>}
                  </h3>

                  {/* Table Filter Button */}
                  <div className="relative" ref={filterRef}>
                    <button 
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${isFilterOpen || tableYear !== 'all' || tableMonth !== 'all' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'}`}
                    >
                      <Filter size={16} />
                      <span>فیلتر تاریخ</span>
                      {(tableYear !== 'all' || tableMonth !== 'all') && (
                        <span className="flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-xs ml-1">
                          !
                        </span>
                      )}
                    </button>

                    {/* Filter Popup */}
                    {isFilterOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                          <span className="text-sm font-bold text-slate-200">فیلتر زمانی جدول</span>
                          {(tableYear !== 'all' || tableMonth !== 'all') && (
                            <button 
                              onClick={() => { setTableYear('all'); setTableMonth('all'); }}
                              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                            >
                              <X size={12} />
                              پاک کردن
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {/* Year Selector */}
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">سال:</label>
                            <div className="relative">
                              <select 
                                value={tableYear}
                                onChange={(e) => {
                                  setTableYear(e.target.value);
                                  // Reset month if it doesn't exist in new year? No, keep logic simple, user sees grayed out options.
                                }}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm appearance-none focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="all">همه سال‌ها</option>
                                {availableYears.map(year => (
                                  <option key={year} value={year}>{toPersianDigits(year)}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                          </div>

                          {/* Month Selector */}
                          <div className="space-y-1">
                            <label className="text-xs text-slate-400">ماه:</label>
                            <div className="relative">
                              <select 
                                value={tableMonth}
                                onChange={(e) => setTableMonth(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm appearance-none focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="all">همه ماه‌ها</option>
                                {PERSIAN_MONTHS.map(month => (
                                  <option 
                                    key={month.value} 
                                    value={month.value}
                                    disabled={isMonthDisabled(month.value)}
                                    className={isMonthDisabled(month.value) ? "text-slate-600 bg-slate-800" : ""}
                                  >
                                    {month.label} {isMonthDisabled(month.value) ? '(بدون داده)' : ''}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <span className="text-slate-400 text-sm">{toPersianDigits(tableData.length)} رکورد نمایش داده شده</span>
              </div>
              
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-b-2xl">
                <table className="w-full text-right">
                  <thead className="bg-slate-900/50 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-4 font-medium text-sm">شماره سند</th>
                      <th className="px-6 py-4 font-medium text-sm">دریافت از</th>
                      <th className="px-6 py-4 font-medium text-sm">تاریخ سررسید</th>
                      <th className="px-6 py-4 font-medium text-sm">مبلغ (تومان)</th>
                      <th className="px-6 py-4 font-medium text-sm">بانک</th>
                      <th className="px-6 py-4 font-medium text-sm">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {tableData.length > 0 ? (
                      tableData.map((cheque) => (
                        <tr key={cheque.id} className="hover:bg-slate-700/30 transition-colors group">
                          <td className="px-6 py-4 text-slate-300 font-mono text-sm">{toPersianDigits(cheque.docNumber)}</td>
                          <td className="px-6 py-4 text-white font-medium">{cheque.receivedFrom}</td>
                          <td className="px-6 py-4 text-emerald-400 font-mono dir-ltr text-right">{toPersianDigits(cheque.dueDate)}</td>
                          <td className="px-6 py-4 text-slate-200 font-bold">{formatCurrency(cheque.amount)}</td>
                          <td className="px-6 py-4 text-slate-400 text-sm">{cheque.bank}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-md text-xs bg-slate-700 text-slate-300 border border-slate-600">
                              {cheque.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                          رکوردی با این فیلتر یافت نشد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default App;