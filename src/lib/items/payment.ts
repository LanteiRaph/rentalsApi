//
import { Item_unary } from "./item";
import {Invoice, Table} from '../classes';

//Model the payment for item, paymant a manul data, ie they are fed into the system, with that its a uniaray item since the stoage is the same as the driver
export class payament extends Item_unary {

    constructor(invoice: Invoice) {
        super(invoice, 'payment');
    }

    //Returns the sql for the poster
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        const sql =  `
            Select
                payment.client,
                payment.payment,
                payment.date,
                payment.ref,
                payment.amount * ${this.invoice.credit} as amount
            From
                payment
                inner join (${await this.current_invoice()}) as invoice
                    on invoice.client=payment.client
            Where
                (${parameterized ? `payment.client= ${this.invoice.parameter} ` : `true`})
                and (${postage ? `payment.invoice is null` : `true`})
                and payment.date <= '${this.operational_cutoff()}'

                and not (${Table.posted('payment')})
        `
        //Check the sql for any errors 
        return await this.invoice.check(sql)
    }

    //posting of payment invlive the likning of the current invoice to the payment taht gall under the current cutoff
    async post(): Promise<boolean> {
        const updatedPayment = await this.invoice.run(`
            Update
                payment
            Inner Join (${await this.poster()}) as poster on
                payment.payment = poster.payment
            Inner join (${await this.current_invoice()}) as invoice
                on payment.client=invoice.invoice
            Set
                payment.invoice = invoice.invoice
        `)
        //check
        if(updatedPayment) return true
        return false
    }
    //unposting of a payment involve the unlinking of the
    async unpost(): Promise<boolean> {
        const unlinked = await this.invoice.run(`
            Update
                payment
                ${this.invoice.current ? `inner join (${await this.current_invoice()}) as invoice
                    on payment.invoice = invoice.invoice
                `:``}
            Set
                payment.invoice = null
        `)
        //check
        if(unlinked) return true
        return false
    }
}