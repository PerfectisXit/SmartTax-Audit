
import { TravelBatchItem, TravelExpenseType, TravelReport } from "../types";

export const calculateTravelReport = (
    items: TravelBatchItem[], // Changed to accept TravelBatchItem to access refundStatus
    manualStartDate: string | null, 
    manualEndDate: string | null,
    enableAllowance: boolean,
    allowanceRate: number
): TravelReport => {
    
    const report: TravelReport = {
        startDate: "",
        endDate: "",
        totalDays: 0,
        allowancePerDay: allowanceRate,
        totalAllowance: 0,
        interCityAmount: 0,
        interCityTax: 0,
        intraCityAmount: 0,
        intraCityTax: 0,
        accommodationAmount: 0,
        accommodationTax: 0,
        trainingAmount: 0,
        trainingTax: 0,
        diningAmount: 0,
        diningTax: 0,
        grandTotalAmount: 0,
        grandTotalTax: 0,
        standardCount: 0,
        standardAmount: 0,
        nonStandardCount: 0,
        nonStandardAmount: 0,
        nonStandardDetails: []
    };

    // Filter valid invoices
    // Rule: Exclude item if it is a detected refund AND user confirmed it as 'confirmed_refund'
    const validItems = items.filter(item => {
        if (item.status !== 'success' || !item.result) return false;
        if (item.result.isRefundDetected && item.refundStatus === 'confirmed_refund') return false;
        return true;
    });

    if (validItems.length === 0) return report;

    // 2. Determine Dates (Optimized Logic)
    let finalStart: Date | null = null;
    let finalEnd: Date | null = null;

    if (validItems.length > 0) {
        // Collect timestamps helper
        const getDates = (filterFn: (i: TravelBatchItem) => boolean) => 
            validItems.filter(filterFn)
            .map(i => new Date(i.result!.invoiceDate).getTime())
            .filter(d => !isNaN(d));

        // Transport: Hard evidence of movement
        const transportDates = getDates(i => 
            i.result?.expenseType === TravelExpenseType.TRAIN || 
            i.result?.expenseType === TravelExpenseType.FLIGHT
        );

        // Accom: Hard evidence of stay (usually checkout date)
        const accomDates = getDates(i => 
            i.result?.expenseType === TravelExpenseType.ACCOMMODATION
        );
        
        // All: Fallback
        const allDates = getDates(() => true).sort((a,b) => a - b);

        // --- Start Date Strategy ---
        // Prioritize Earliest Transport (Departure). 
        // If missing, use Earliest of Any Invoice.
        let startTime = allDates[0];
        if (transportDates.length > 0) {
            startTime = Math.min(...transportDates);
        }

        // --- End Date Strategy ---
        // Prioritize Latest of (Transport OR Accommodation).
        // Accommodation Checkout is a strong signal of end of stay.
        // Transport Return is a strong signal of end of trip.
        // If neither, use Latest of Any Invoice.
        let endTime = allDates[allDates.length - 1];
        
        const meaningfulEndDates = [...transportDates, ...accomDates];
        if (meaningfulEndDates.length > 0) {
            endTime = Math.max(...meaningfulEndDates);
        }

        // Auto-calculated dates
        const autoStart = new Date(startTime);
        const autoEnd = new Date(endTime);

        // Apply Manual Overrides or Defaults
        finalStart = manualStartDate ? new Date(manualStartDate) : autoStart;
        finalEnd = manualEndDate ? new Date(manualEndDate) : autoEnd;
        
        report.startDate = finalStart.toISOString().split('T')[0];
        report.endDate = finalEnd.toISOString().split('T')[0];
        
        // Calculate Duration (Inclusive)
        // e.g. Mon to Mon = 1 day? No, usually 1 day if same day.
        // But if Mon start, Tue end = 2 days.
        const diffTime = Math.abs(finalEnd.getTime() - finalStart.getTime());
        report.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // 3. Calculate Allowance
    if (enableAllowance) {
        report.totalAllowance = report.totalDays * report.allowancePerDay;
    }

    // 4. Aggregate Expenses & Stats
    const nonStandardMap: Record<string, number> = {};

    validItems.forEach(item => {
        const inv = item.result!;
        const amount = Number.isFinite(inv.totalAmount) ? inv.totalAmount : 0;
        const tax = Number.isFinite(inv.taxAmount) ? inv.taxAmount : 0;

        report.grandTotalAmount += amount;
        report.grandTotalTax += tax;

        // Statistics: Standard vs Non-Standard
        // Note: Gemini usually returns 'vat_invoice' for standard ones. 
        const isTrueStandard = inv.documentType === 'vat_invoice';

        if (isTrueStandard) {
            report.standardCount++;
            report.standardAmount += amount;
        } else {
            report.nonStandardCount++;
            report.nonStandardAmount += amount;
            
            // Map details
            const typeName = getDocumentTypeName(inv.documentType || 'other');
            nonStandardMap[typeName] = (nonStandardMap[typeName] || 0) + 1;
        }

        switch (inv.expenseType) {
            case TravelExpenseType.TRAIN:
            case TravelExpenseType.FLIGHT:
                report.interCityAmount += amount;
                report.interCityTax += tax;
                break;
            case TravelExpenseType.TAXI:
                report.intraCityAmount += amount;
                report.intraCityTax += tax;
                break;
            case TravelExpenseType.ACCOMMODATION:
                report.accommodationAmount += amount;
                report.accommodationTax += tax;
                break;
            case TravelExpenseType.TRAINING:
                report.trainingAmount += amount;
                report.trainingTax += tax;
                break;
            case TravelExpenseType.DINING:
                report.diningAmount += amount;
                report.diningTax += tax;
                break;
            default:
                break;
        }
    });

    // Format Non-Standard Details
    report.nonStandardDetails = Object.entries(nonStandardMap).map(([name, count]) => `${name} x${count}`);

    if (enableAllowance) {
        report.grandTotalAmount += report.totalAllowance;
    }

    return report;
};

function getDocumentTypeName(type: string): string {
    const map: Record<string, string> = {
        'train_ticket': '火车票',
        'flight_itinerary': '行程单',
        'boarding_pass': '登机牌',
        'taxi_receipt': '出租车票',
        'screenshot': '订单截图',
        'other': '其他凭证',
        'vat_invoice': '发票'
    };
    return map[type] || '其他';
}
