export interface I_Invoice {
    opening_balance?: (OpeningBalanceEntity)[] | null;
    invoice?: (InvoiceEntity)[] | null;
    rent?: (RentEntity)[] | null;
    water?: (null)[] | null;
    power?: (PowerEntity)[] | null;
    payment?: (null)[] | null;
    credits?: (null)[] | null;
    debits?: (null)[] | null;
    closing_balance?: (ClosingBalanceEntity)[] | null;
}
export interface OpeningBalanceEntity {
    date: string;
    amount: number;
    client: number;
}
export interface InvoiceEntity {
    client: number;
    id: string;
    full_name: string;
    year: number;
    month: number;
}
export interface RentEntity {
    client: number;
    agreement: number;
    room_no: string;
    price: number;
    factor?: null;
    rental_period: string;
    amount?: null;
    agreement_start_date: string;
}
export interface PowerEntity {
    eaccount_no: string;
    emeter_no: string;
    payable_to_kplc?: null;
    due_date?: null;
    sharing: string;
    amount?: null;
    client: number;
    eaccount: number;
    ebill?: null;
}
export interface ClosingBalanceEntity {
    amount: number;
    client: number;
}
