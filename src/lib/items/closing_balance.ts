//Closing balance is a binary item because posting it involves 2 entiies:-
//a) client as the driver and 
//b) closing_balance as the storage table for the posted items
import { Invoice } from "../classes";
import { Item_binary } from "./item";

export class Item_closing_balance extends Item_binary {
    //Creat the class. Its an aesthetic item . its not used to claculate the invoice
    constructor(record: Invoice) {
        //Create the parent
        super(record, 'client', 'closing_balance');
        //Its aesthetic
        this.aesthetics = true;
    }

    //To post an closing balance we need to-:
    //1.Create a new period for the next period
    //2.Create a new invoice for that period.
    //3.Create a closing balance for the new period(opening_balance)
    async post(): Promise<boolean> {
        //Get the current period
        const date = this.cutoffToString()
        //1.
        const period = await this.invoice.run(`
            insert into 
                period(year, month, cutoff)
                value(year(${date}), month(${date}), ${date})
            on duplicate key update
                year=values(year),
                month=values(month),
                cutoff=values(cutoff)
        `)
        //2. 
        const invoice = await this.invoice.run(`
                insert into
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
        //3. 
        const closingsql = `
                insert into 
                    closing_balance(amount, invoice, posted)
                    (
                        select
                            poster.amount, invoice.invoice, 0 as posted
                        from
                            (${await this.detailed_poster(false, false)}) as poster
                            inner join (${await this.current_invoice()}) as invoice
                                on invoice.client = poster.client
                    )
                on duplicate key update
                    amount = values(amount)
        `
        //Create a prims sql 
        const closing = await this.invoice.run(closingsql)
        //Check for the stsus of the created closing balance
        if (closing && invoice && period) return true
        //Always return a false posting never happened
        return false
    }

    //returns an sql that 
    async detailed_poster(parametriezed = true, postage = true): Promise<string> {
        const sql = `
            Select
                summary.amount,
                client.client
            From
                client
                inner join (${await this.summation(parametriezed)}) as summary
                on summary.client = client.client
                left join (${await this.posted_items()}) as storage on 
                storage.client = client.client 
            Where
                ${parametriezed ? `client.client=${this.invoice.parameter}` : `true`}
                and ${postage ? `storage.client is null` : `true`}
        `
        //
        return await this.invoice.check(sql)
    }

    //
    //Returns the sql for computing the closing balance 
    //Sum of all non-aesthetis items
    async summation(parametriezed = true): Promise<string> {
        return await this.invoice.check(`
            Select
                sum(unItems.amount) as amount,
                unItems.client
            From
                (${await this.union_of_na_items(parametriezed)}) as unItems
            Group by
                unItems.client
        `)
    }
    //
    //Returns the sql for all the union items that are used to compute the closing balance
    async union_of_na_items(parameterized = true): Promise<string> {
        //Start with an empty sql
        let sql = ``;
        //Start with a empty union oparetor
        let union = ``;
        //Step throuth thee items and for each item compile and sql 
        for (let i of this.invoice.items) {
            //Destructure to obtein the current item
            const [string, item] = i
            //Check if items if of type aesthetic
            if (!item.aesthetics) {
                sql = sql + union + ` 
                    Select 
                        poster.amount,
                        poster.client 
                from (${await item?.detailed_poster(parameterized, false)}) as poster `

                union = ` union all `
            }
        }
        // //Compile a static version of the ites for union puposes.
        // const items = ['payment', 'water', 'opening_balance', 'credits', 'debits', 'rent'];

        // //Step through the items used for computation and 
        // for (let i = 0; i < items.length; i++) {
        //     //
        //     let item = this.invoice.items.get(items[i])
        //     //Check if item is valid
        //     if(item){
        //         sql = sql + union + ` 
        //             Select 
        //                 poster.amount,
        //                 poster.client 
        //         from (${await item?.detailed_poster(false, false)}) as poster `

        //         union = ` union all `
        //     }

        // }

        return sql
    }
    //
    //The cutoff associated with the current closing balance always the next
    cutoffToString(n = 0) {
        return this.invoice.cutoffToString(n + 1)
    }
    //
    //Unposting a closing-baance involves 
    //Delete the closing balance that matches the currrent invoice 
    //Followed by deleting the invoice for the next period
    //Then deleting the nect period
    async unpost(): Promise<boolean> {
        //Unpost the super(parent ) it will inlink the closing balances with the current invoice
        await super.unpost()
        //delete the invoice 
        await this.invoice.run(`
                delete
                    invoice.*
                from invoice 
                    inner join period on invoice.period=period.period
                where
                    period.year = year('${this.cutoffToString()}')
                    and period.month = month('${this.cutoffToString()}')
            `)

        //Delete the period
        const period = await this.invoice.run(`
            Delete
                period.*
            From
                period
            Where
                period.year = year('${this.cutoffToString()}')
                and period.month = month('${this.cutoffToString()}')
        `)
        if (period) return true
        return false
    }

    //Override the detailed poster for the
    async detailed_report(parametarized?: boolean): Promise<string> {
        return await this.invoice.check(`
            Select
                closing_balance.amount
                concat('01-', period_next.month, '-', period_next.year) as due_on
            From
                closing_balance
                inner join invoice as invoice_next on closing_balance.invoice = invoice_next.invoice
                inner join invoice as invoice_current on 
                    invoice_current.client = invoice_next.client
                inner join period as period_next on invoice_next.period =period_next.period
                inner join perios as pereios_current on 
                period_current.period = invoice_current.period
            Where
                period_next.monht = month(period_current.cutoff + interval 1 day)
                period_next.year = (period_current.cutoff + interval 1 day) and 
                ${parametarized ? `invoice_current.invoice = ${this.invoice.parameter}` : `true`}
        
        `)
    }

}