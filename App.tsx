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
  Loader2,
  ChevronDown,
  X,
  BarChart3,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Hash,
  Copy,
  DownloadCloud,
  Zap,
  Brain,
  Settings,
  Server,
  ServerCrash
} from 'lucide-react';
import { Cheque, MonthlyStats, RawChequeData, AnomalyReport } from './types';
import { normalizeChequeData, getCurrentJalaliDate, formatCurrency, toPersianDigits } from './utils/helpers';
import { fetchCheques, syncCheques } from './utils/api';
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
  // --- Dataset State ---
  const [datasetId, setDatasetId] = useState<string>(() => {
    try {
      return localStorage.getItem('cheque_dataset_id') || '';
    } catch {
      return '';
    }
  });
  const [inputId, setInputId] = useState(datasetId);

  const [data, setData] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('در حال پردازش...');
  const [filterUser, setFilterUser] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentDate] = useState(getCurrentJalaliDate()); 
  
  // Table Specific Filters
  const [tableYear, setTableYear] = useState<string>('all');
  const [tableMonth, setTableMonth] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof Cheque; direction: 'asc' | 'desc' } | null>({ key: 'dueDate', direction: 'asc' });

  // Chart Range
  const [chartRange, setChartRange] = useState<number>(9);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Fetch
  useEffect(() => {
    if (datasetId) {
      refreshData(datasetId);
    }
  }, [datasetId]);

  // Update input when datasetId changes
  useEffect(() => {
    setInputId(datasetId);
  }, [datasetId]);

  const refreshData = async (targetId: string = datasetId) => {
    if (!targetId) return;

    setLoading(true);
    setLoadingText('در حال دریافت اطلاعات از سرور...');

    try {
      const serverData = await fetchCheques('', targetId);
      setData(serverData);
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      // Don't clear data immediately on error to avoid flashing, but maybe show alert
      if(data.length === 0) setData([]);
    } finally {
      setLoading(false);
    }
  };

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

  const generateDatasetId = () => {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newId = generateDatasetId();
    setLoading(true);
    setLoadingText('در حال آنالیز و ذخیره در دیتابیس...');

    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json<RawChequeData>(ws);

          const normalized = jsonData
            .map((row, index) => normalizeChequeData(row, index))
            .filter((item): item is Cheque => item !== null);

          // Upload to Server with Unique ID
          await syncCheques('', normalized, newId);
          
          // Update State
          setDatasetId(newId);
          localStorage.setItem('cheque_dataset_id', newId);
          
          // Refresh Data from DB using new ID
          await refreshData(newId);
          
          if (fileInputRef.current) fileInputRef.current.value = '';
          alert(`فایل با موفقیت آپلود و ذخیره شد.\nشناسه اختصاصی شما: ${newId}`);

        } catch (error: any) {
          console.error("Error processing file:", error);
          alert(`خطا در آپلود: ${error.message}`);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    }, 100);
  };

  const handleLoadDataset = () => {
    if (!inputId || inputId.length < 5) {
      alert("لطفا یک شناسه معتبر وارد کنید");
      return;
    }
    setDatasetId(inputId);
    localStorage.setItem('cheque_dataset_id', inputId);
    refreshData(inputId);
  };

  const copyToClipboard = () => {
    if (datasetId) {
        navigator.clipboard.writeText(datasetId);
    }
  };

  // --- Calculations & Filtering ---
  const handleSort = (key: keyof Cheque) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const uniqueNames = useMemo(() => {
    const names = new Set(data.map(item => item.receivedFrom));
    return Array.from(names).filter(Boolean).sort();
  }, [data]);

  const suggestions = useMemo(() => {
    if (!filterUser.trim()) return [];
    return uniqueNames.filter(name => 
      name.toLowerCase().includes(filterUser.toLowerCase()) &&
      name !== filterUser
    ).slice(0, 6);
  }, [uniqueNames, filterUser]);

  const handleSelectName = (name: string) => {
    setFilterUser(name);
    setShowSuggestions(false);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const isFuture = item.dueDate >= currentDate;
      const matchesUser = filterUser 
        ? item.receivedFrom.includes(filterUser) 
        : true;
      return isFuture && matchesUser;
    });
  }, [data, filterUser, currentDate]);

  const pastData = useMemo(() => {
      return data.filter(item => item.dueDate < currentDate);
  }, [data, currentDate]);

  const availableYears = useMemo(() => {
    const years = new Set(filteredData.map(d => d.dueDate.substring(0, 4)));
    return Array.from(years).sort();
  }, [filteredData]);

  const tableData = useMemo(() => {
    let result = filteredData.filter(item => {
        const y = item.dueDate.substring(0, 4);
        const m = item.dueDate.substring(5, 7);
        const matchYear = tableYear === 'all' || y === tableYear;
        const matchMonth = tableMonth === 'all' || m === tableMonth;
        return matchYear && matchMonth;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [filteredData, tableYear, tableMonth, sortConfig]);

  const isMonthDisabled = (mVal: string) => {
    if (tableYear === 'all') {
        return !filteredData.some(d => d.dueDate.substring(5, 7) === mVal);
    }
    return !filteredData.some(d => d.dueDate.substring(0, 4) === tableYear && d.dueDate.substring(5, 7) === mVal);
  };

  const analytics = useMemo(() => {
    const monthlyStatsMap = new Map<string, { amount: number; count: number }>();
    let totalFutureAmount = 0;
    let totalFutureCount = 0;
    const payerAmounts = new Map<string, number>();

    filteredData.forEach(item => {
      const monthKey = item.dueDate.substring(0, 7); 
      const current = monthlyStatsMap.get(monthKey) || { amount: 0, count: 0 };
      
      monthlyStatsMap.set(monthKey, {
        amount: current.amount + item.amount,
        count: current.count + 1
      });

      totalFutureAmount += item.amount;
      totalFutureCount += 1;

      const currentPayerTotal = payerAmounts.get(item.receivedFrom) || 0;
      payerAmounts.set(item.receivedFrom, currentPayerTotal + item.amount);
    });

    const monthlyStats: MonthlyStats[] = Array.from(monthlyStatsMap.entries())
      .map(([month, stats]) => ({
        month,
        totalAmount: stats.amount,
        count: stats.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    let topPayer = { name: 'ندارد', amount: 0 };
    payerAmounts.forEach((amount, name) => {
      if (amount > topPayer.amount) {
        topPayer = { name, amount };
      }
    });

    return { monthlyStats, totalFutureAmount, totalFutureCount, topPayer };
  }, [filteredData]);

  const chartData = useMemo(() => {
    return analytics.monthlyStats.slice(0, chartRange);
  }, [analytics.monthlyStats, chartRange]);

  const anomalyReport: AnomalyReport = useMemo(() => {
    if (pastData.length === 0 || filteredData.length === 0) {
      return { isNormal: true, averageMonthlyCount: 0, futureAvgCount: 0, details: "دیتای کافی نیست" };
    }
    const pastMonths = new Set(pastData.map(d => d.dueDate.substring(0, 7))).size;
    const avgPast = pastData.length / (pastMonths || 1);
    const futureMonths = analytics.monthlyStats.length;
    const avgFuture = filteredData.length / (futureMonths || 1);
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
      
      {/* Loading Screen */}
      {loading && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-500 px-4 text-center">
          <div className="relative mb-8 scale-75 sm:scale-100">
            <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full animate-pulse"></div>
            <div className="absolute -inset-4 border-t-2 border-r-2 border-cyan-400/60 rounded-full animate-spin duration-[1.5s]"></div>
            <div className="absolute -inset-8 border-b-2 border-l-2 border-blue-500/40 rounded-full animate-spin direction-reverse duration-[2s]"></div>
            <div className="relative z-10 bg-slate-900 p-8 rounded-full border border-slate-700 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
               <Database size={80} className="text-cyan-400 animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
               <Zap size={24} className="absolute -top-1 -right-1 text-yellow-400 animate-bounce fill-yellow-400" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide mb-2 animate-pulse leading-snug">{loadingText}</h2>
          <p className="text-cyan-500/80 font-mono text-sm tracking-wider animate-pulse">CONNECTING TO POSTGRES...</p>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg shadow-lg shadow-emerald-500/20">
              <TrendingUp className="text-white h-6 w-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide hidden sm:block">
              داشبورد <span className="text-emerald-400">چک و نقدینگی</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
             
             {/* Display Dataset ID in Header if active */}
             {datasetId && !loading && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl mr-2 shadow-inner animate-in fade-in slide-in-from-top-4 duration-500">
                    <span className="text-xs text-slate-400 font-medium">کد گزارش:</span>
                    <span className="text-sm font-mono font-bold text-emerald-400 tracking-widest border-b border-emerald-500/20 pb-0.5">
                      {toPersianDigits(datasetId)}
                    </span>
                    <button 
                      onClick={copyToClipboard} 
                      className="p-1 hover:bg-slate-700 rounded-md transition-colors text-slate-500 hover:text-white"
                      title="کپی شناسه"
                    >
                      <Copy size={12} />
                    </button>
                </div>
             )}

             <div className="flex items-center gap-2 px-3 py-1 bg-violet-900/30 border border-violet-500/30 rounded-full">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></div>
                <span className="text-xs text-violet-300">Cloud DB</span>
             </div>

             <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm font-medium disabled:opacity-50"
            >
              <UploadCloud size={18} />
              <span className="hidden sm:inline">آپلود جدید</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Central Electric ID Switcher */}
        <div className="relative group w-full max-w-lg mx-auto mb-12 z-20">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-emerald-500 to-cyan-400 rounded-2xl blur-lg opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          
          <div className="relative flex items-center bg-slate-900 rounded-2xl border border-slate-700/50 p-2 shadow-2xl ring-1 ring-white/10">
            <div className="pl-4 pr-3 text-emerald-400">
               <Hash size={24} />
            </div>
            
            <div className="flex-1 flex flex-col justify-center border-l border-r border-slate-700/50 px-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">شناسه دیتاست</span>
              <input 
                  type="text" 
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value.replace(/[^0-9]/g, '').slice(0,9))}
                  placeholder="--- --- ---"
                  className="bg-transparent border-none focus:outline-none text-white text-xl font-mono font-bold tracking-[0.3em] placeholder:text-slate-700 w-full text-center h-7"
                  maxLength={9}
               />
            </div>

             <button 
                onClick={handleLoadDataset}
                disabled={!inputId || inputId.length < 5}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none mx-1"
                title="بارگذاری"
             >
                <Zap size={24} className={inputId && inputId.length > 5 ? "fill-white" : ""} />
             </button>
          </div>
          
          <div className="absolute top-full left-0 right-0 flex justify-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-xs text-emerald-400 font-medium bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-sm border border-emerald-500/20">
              شناسه ۹ رقمی فایل خود را وارد کنید
            </span>
          </div>
        </div>

        {/* Empty State / No ID */}
        {(!datasetId || (data.length === 0 && !loading)) && (
           <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-slate-700 rounded-3xl bg-slate-800/20 animate-fade-in relative overflow-hidden">
             
             <div className="relative z-10 flex flex-col items-center">
                <div className="bg-slate-800 p-6 rounded-full mb-4 relative ring-4 ring-slate-800 border border-slate-700">
                  <Database size={64} className="text-slate-500" />
                  <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-full shadow-lg">
                    <UploadCloud size={20} className="animate-bounce" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold text-slate-300 mb-2">
                  {datasetId ? "داده‌ای یافت نشد" : "خوش آمدید"}
                </h2>
                <p className="text-slate-400 max-w-md mb-8 px-4">
                    برای شروع، فایل اکسل خود را آپلود کنید تا یک شناسه اختصاصی دریافت کنید، یا شناسه قبلی خود را در کادر بالا وارد نمایید.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 text-lg group"
                  >
                      <UploadCloud size={24} className="group-hover:scale-110 transition-transform" />
                      آپلود فایل جدید
                  </button>
                </div>
             </div>

             {/* Background Decoration */}
             <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                 <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl"></div>
                 <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/30 rounded-full blur-3xl"></div>
             </div>
           </div>
        )}

        {/* Dashboard Content */}
        {data.length > 0 && !loading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* ID Info Banner */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-emerald-400">
                    <div className="bg-emerald-500/20 p-2 rounded-full">
                       <CheckCircle size={20} />
                    </div>
                    <span className="font-medium">اطلاعات با موفقیت بارگذاری شد</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 p-2 pr-4 rounded-xl border border-slate-700/50">
                    <span className="text-slate-400 text-sm">شناسه فعلی:</span>
                    <button 
                        onClick={copyToClipboard}
                        className="text-white font-mono font-bold tracking-widest text-lg hover:text-emerald-400 transition-colors flex items-center gap-2"
                        title="کپی در حافظه"
                    >
                        {toPersianDigits(datasetId)}
                        <Copy size={16} className="text-slate-500 hover:text-white" />
                    </button>
                </div>
            </div>

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
                value={filterUser ? formatCurrency(analytics.totalFutureAmount) : '---'}
                subValue={filterUser ? "ریال" : "برای نمایش، نام را فیلتر کنید"}
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
                subValue={`مبلغ: ${formatCurrency(analytics.topPayer.amount)} ریال`}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <LiquidityChart data={chartData} />
              <CountChart data={chartData} />
            </div>

            {/* Detailed List Section */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl shadow-xl">
              <div className="p-4 sm:p-6 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-t-2xl bg-slate-800/40 relative">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="text-emerald-500" />
                    لیست چک‌های آینده
                    {filterUser && <span className="hidden sm:inline text-sm font-normal text-slate-400 mr-2">(فیلتر شده برای: {filterUser})</span>}
                  </h3>

                  <div className="flex items-center gap-2 mr-auto sm:mr-0">
                    <button 
                      onClick={() => handleSort('amount')}
                      className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap ${
                        sortConfig?.key === 'amount' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      {sortConfig?.key === 'amount' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                      <span>مبلغ</span>
                    </button>

                    <div className="relative" ref={filterRef}>
                      <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border whitespace-nowrap ${isFilterOpen || tableYear !== 'all' || tableMonth !== 'all' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'}`}
                      >
                        <Filter size={16} />
                        <span>فیلتر تاریخ</span>
                        {(tableYear !== 'all' || tableMonth !== 'all') && (
                          <span className="flex items-center justify-center w-5 h-5 bg-emerald-500 text-white rounded-full text-xs ml-1">
                            !
                          </span>
                        )}
                      </button>

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
                            <div className="space-y-1">
                              <label className="text-xs text-slate-400">سال:</label>
                              <div className="relative">
                                <select 
                                  value={tableYear}
                                  onChange={(e) => {
                                    setTableYear(e.target.value);
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
                </div>

                <span className="text-slate-400 text-xs sm:text-sm self-end sm:self-auto">{toPersianDigits(tableData.length)} رکورد نمایش داده شده</span>
              </div>
              
              <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto rounded-b-2xl custom-scrollbar">
                <table className="w-full text-right">
                  <thead className="bg-slate-900/50 text-slate-400 sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-4 font-medium text-sm">شماره سند</th>
                      <th className="px-6 py-4 font-medium text-sm">دریافت از</th>
                      
                      <th 
                        className="px-6 py-4 font-medium text-sm cursor-pointer hover:text-emerald-400 transition-colors group select-none"
                        onClick={() => handleSort('dueDate')}
                      >
                        <div className="flex items-center gap-2">
                          تاریخ سررسید
                          {sortConfig?.key === 'dueDate' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-emerald-400" /> : <ArrowDown size={14} className="text-emerald-400" />
                          ) : (
                            <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                          )}
                        </div>
                      </th>

                      <th 
                        className="px-6 py-4 font-medium text-sm cursor-pointer hover:text-emerald-400 transition-colors group select-none"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center gap-2">
                          مبلغ (ریال)
                          {sortConfig?.key === 'amount' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-emerald-400" /> : <ArrowDown size={14} className="text-emerald-400" />
                          ) : (
                            <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                          )}
                        </div>
                      </th>

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

              <div className="md:hidden max-h-[500px] overflow-y-auto p-4 space-y-4">
                 {tableData.length > 0 ? (
                    tableData.map((cheque) => (
                      <div key={cheque.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl space-y-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">دریافت از</p>
                            <p className="text-white font-bold text-lg">{cheque.receivedFrom}</p>
                          </div>
                           <div className="text-left">
                            <p className="text-xs text-slate-500 mb-1">مبلغ (ریال)</p>
                            <p className="text-emerald-400 font-bold text-lg font-mono">{formatCurrency(cheque.amount)}</p>
                          </div>
                        </div>

                        <div className="h-px bg-slate-700/50" />

                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <p className="text-xs text-slate-500 mb-1">تاریخ سررسید</p>
                              <p className="text-slate-300 font-mono text-sm">{toPersianDigits(cheque.dueDate)}</p>
                           </div>
                           <div>
                              <p className="text-xs text-slate-500 mb-1">شماره سند</p>
                              <p className="text-slate-300 font-mono text-sm">{toPersianDigits(cheque.docNumber)}</p>
                           </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">بانک</p>
                              <p className="text-slate-300 text-sm">{cheque.bank}</p>
                           </div>
                           <div>
                              <p className="text-xs text-slate-500 mb-1">وضعیت</p>
                               <span className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600 inline-block">
                                {cheque.status}
                              </span>
                           </div>
                        </div>
                      </div>
                    ))
                 ) : (
                    <div className="text-center py-10 text-slate-500">
                      رکوردی با این فیلتر یافت نشد
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;