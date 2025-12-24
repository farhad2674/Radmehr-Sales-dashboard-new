export interface RawChequeData {
  'شماره اسناد': number | string;
  'سری': string;
  'بانک': string;
  'مبلغ': number | string; // Excel might read as string with commas
  'تاریخ سررسید': string; // Jalali Date YYYY/MM/DD
  'آخرین وضعیت': string;
  'تاریخ عملیات': string;
  'دریافت از': string;
  'پرداخت به': string;
  'توضیحات'?: string;
}

export interface Cheque {
  id: string;
  docNumber: string;
  amount: number;
  dueDate: string; // YYYY/MM/DD
  receivedFrom: string;
  status: string;
  bank: string;
}

export interface MonthlyStats {
  month: string; // YYYY/MM
  totalAmount: number;
  count: number;
}

export interface FilterState {
  receivedFrom: string;
  minDate: string; // Jalali YYYY/MM/DD
}

export interface AnomalyReport {
  isNormal: boolean;
  averageMonthlyCount: number;
  futureAvgCount: number;
  details: string;
}