//the invoice itm is a specila item since ite hold a time in to
//!.  the item is posted as the first
//2. the item is unposted last
//all posted items make refrence to it
//all its data is automativaly generated

import { Invoice } from "../classes";
import { Item_binary } from "./item";

//its report sql and poster is identical
export class Item_Invoice extends Item_binary {
    constructor(invoice: Invoice) {
        super(invoice, 'client', 'invoice')
        //Set the aesthetis to flase, this item its not used to calculate closing baln
        this.aesthetics = true
    }
    //Detailed poster sql 
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        //
        return await this.invoice.check( `
            Select
                client.client,
                client.name as id,
                client.title as full_name,
                ${this.invoice.year} as year,
                ${this.invoice.month} as month
            From
                client
            Where
                ${parameterized ? `client.client=${this.invoice.parameter}` : `true`}
                and ${postage ? `true` : `true`}
        `)
    }
    //Impliment the ost for the invoice to post it we need to creat an new period.
    //Then link the new invoice to the new period
    async post(): Promise<boolean> {
        //Perfom the creation of period
        const newPeriod = await this.invoice.run(`
            Insert
                into period(year, month,cutoff)
                values(${this.invoice.year}, ${this.invoice.month}, '${this.invoice.cutoffToString()}')

            On duplicate key
                update year=values(year)
        `)
        //Perfom a creation of the new invoice
        const newInvoice = await this.invoice.run(`
            Insert Into 
                invoice(client, period, is_valid)
                (
                    Select
                        poster.client,
                        period.period,
                        0 as is_valid
                    From
                        (${await this.poster()}) as poster
                        join (${await this.current_period()}) as period
                )
                on duplicate key update
                        period=values(period)  
        `)
        //Check
        if (newInvoice && newPeriod) return true
        return false
    }
    //Unpost the invoice
    //check the if current period is set if not unpost the whol db
    async unpost(): Promise<boolean> {
        //Check if current invoice true
        if (!this.invoice.current) {
            await this.invoice.run(`
                Delete
                    invoice.*
                From
                    invoice
            `)
            //Unpost the period
            await this.invoice.run(`
                Delete
                    period
                From
                    period
            `)
            return true
        } else {
            //Bounded to the closing_balance
            await this.invoice.run(`
                delete
                    invoice.*
                from
                    invoice
                    left join closing_balance
                        on closing_balance.invoice=invoice.invoice
                    inner join (${await this.current_invoice()}) as curr_invoice
                        on invoice.invoice = curr_invoice.invoice
                Where
                    closing_balance.closing_balance is null
            `)
            //The period
            await this.invoice.run(`
                Delete
                    period
                From
                    period
                    left join invoice on invoice.period = period.period
                Where
                    invoice.invoice is null 
            `)

            return true
        }
    }

    //override the detailposter method
    async detailed_report(parametarized?: boolean): Promise<string> {
        return await this.invoice.check(`
            Select 
                client.name as id,
                client.title as client_name,
                period.year,
                period.month,
                concat(client.name, '-' , period.year, '-', period.month) as ref
            From 
                client
                inner join invoice 
                    on invoice.client  = client.client
                inner join period on invoice.period=period.period
            Where
                ${parametarized? `invoice.invoice = ${this.invoice.parameter}`: `true`}
        
        `)
    }
}