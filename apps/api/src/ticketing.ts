export interface TicketInventory {
  zone: string;
  capacity: number;
  sold: number;
  accessibleSeats: number;
}

export interface TicketSale {
  id: string;
  zone: string;
  quantity: number;
  totalCents: number;
  status: 'completed' | 'refunded' | 'voided';
}

export interface FanExperienceRequest {
  id: string;
  type: 'refund' | 'parking-pass' | 'crowd-density-alert' | 'accessibility-service';
  status: 'open' | 'in-progress' | 'resolved';
  details: string;
}

export interface ConcessionsDemandForecast {
  attendance: number;
  expectedTransactions: number;
  demandBand: 'low' | 'medium' | 'high';
  staffingRecommendation: number;
  model: 'baseline-attendance-ratio';
}

export function remainingInventory(inventory: TicketInventory): number {
  return Math.max(0, inventory.capacity - inventory.sold);
}

export function forecastConcessionsDemand(attendance: number): ConcessionsDemandForecast {
  const normalizedAttendance = Math.max(0, Math.round(attendance));
  const expectedTransactions = Math.round(normalizedAttendance * 0.7);
  const demandBand = expectedTransactions >= 5000 ? 'high' : expectedTransactions >= 1500 ? 'medium' : 'low';
  const staffingMultiplier = demandBand === 'high' ? 1 / 140 : demandBand === 'medium' ? 1 / 175 : 1 / 220;
  return {
    attendance: normalizedAttendance,
    expectedTransactions,
    demandBand,
    staffingRecommendation: Math.max(1, Math.ceil(expectedTransactions * staffingMultiplier)),
    model: 'baseline-attendance-ratio',
  };
}
