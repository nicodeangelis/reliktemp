export type Currency = 'ARS' | 'USD';

export interface Property {
  id: string;
  address: string;
  unit: string;
  ownerName: string;
  type: 'Departamento' | 'Local' | 'Oficina';
  floor?: string;
  m2?: number;
}

export interface Tenant {
  id: string;
  name: string;
  dni_cuit: string;
}

export interface Contract {
  id: string;
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  currency: Currency;
  monthlyAmount: number;
  status: 'Vigente' | 'Finalizado' | 'Rescindido';
  destination: 'Vivienda' | 'Comercial';
  guarantorName?: string;
  securityDeposit: number;
  services: string[];
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Ingreso' | 'Egreso';
  concept: string;
  amount: number;
  currency: Currency;
  contractId?: string;
  receiptNumber?: string;
  status: 'Pagado' | 'Pendiente';
}

export interface Provider {
  id: string;
  name: string;
  cuit: string;
  ivaStatus: string;
}

export interface Receipt {
  id: string;
  providerId: string;
  date: string;
  number: string;
  type: 'FC A' | 'FC B' | 'FC C' | 'Ticket';
  amount: number;
  currency: Currency;
  description: string;
}
