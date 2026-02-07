export interface StaffRangeRule {
  minTotal: number;
  maxTotal: number;
  staffMin: number;
  staffMax: number;
  label: string;
}

export interface DiningRuleConfig {
  amountMultiple: number;
  requireAmountGreaterThanInvoice: boolean;
  baseStaffMin: number;
  baseStaffMax: number;
  staffRanges: StaffRangeRule[];
}

export const DEFAULT_DINING_RULES: DiningRuleConfig = {
  amountMultiple: 150,
  requireAmountGreaterThanInvoice: true,
  baseStaffMin: 1,
  baseStaffMax: 3,
  staffRanges: [
    { minTotal: 0, maxTotal: 6, staffMin: 1, staffMax: 2, label: '总人数较少' },
    { minTotal: 10, maxTotal: Number.POSITIVE_INFINITY, staffMin: 2, staffMax: 3, label: '总人数较多' },
    { minTotal: 7, maxTotal: 9, staffMin: 1, staffMax: 3, label: '总人数中等' }
  ]
};

export const resolveStaffRange = (totalPeople: number, config: DiningRuleConfig) => {
  const range = config.staffRanges.find(r => totalPeople >= r.minTotal && totalPeople <= r.maxTotal);
  return range || { minTotal: 0, maxTotal: Number.POSITIVE_INFINITY, staffMin: config.baseStaffMin, staffMax: config.baseStaffMax, label: '默认范围' };
};
