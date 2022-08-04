import { Invoice, Table } from "../classes";
import { Item_unary } from "./item";

/**Adjustments represnet any correction made to an account 
 * they can either be positve and negative
 * for positive they credit the account it money is deposited to the account
 * that means they deduct from the closing balance; credit = -1
 * for negative money add to the account; debit = 1
 */

export class Item_credit extends Item_unary{
    //Create the item with the parent invoice.
    constructor(invoice:Invoice){
        super(invoice, 'credit')
        this.is_credit = true
    }

    //Over Ride the detailed poster sl to obtain the credit version
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        return await this.invoice.check(`
            Select 
                credit.client,
                credit.credit,
                credit.date,
                credit.reason,
                credit.amount * ${this.invoice.credit} as amount
            From
                credit
                left join (${await this.current_invoice()}) as invoice 
                    on invoice.client = credit.client 
            Where
                ${parameterized ? `credit.client = ${this.invoice.parameter}`:`true`}
                and ${postage ? `credit.invoice is null` : `true`}
                and credit.date <= '${this.operational_cutoff()}'
                and not(${Table.posted('credit')})
        `)
    }
}


export class Item_debit extends Item_unary{
    //Create the class with the parent invoice.
    constructor(invoice:Invoice){
        super(invoice, 'debit')
    }
    //Over ride the detail_poster to retun a unique sql for the item
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        return await this.invoice.check(`
            Select 
                debit.date,
                debit.reason,
                debit.amount * ${this.invoice.debit} as amount,
                debit.client,
                debit.debit
            From
                debit
                left join (${await this.current_invoice()}) as invoice
                on invoice.client=debit.client
            Where
                ${parameterized ? `debit.client=${this.invoice.parameter}`: `true`}
                and ${postage ? `debit.invoice is null` : `true`}
                and debit.date<= '${this.operational_cutoff()}'
                and not(${Table.posted('debit')}) 
        `)
    }
}