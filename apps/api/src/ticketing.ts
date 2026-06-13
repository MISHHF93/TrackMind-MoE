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

export function remainingInventory(inventory: TicketInventory): number {
  return Math.max(0, inventory.capacity - inventory.sold);
}

export function forecastConcessionsDemand(attendance: number) {
  return { placeholder: true, expectedTransactions: Math.round(attendance * 0.7), model: 'baseline-attendance-ratio' };
}
