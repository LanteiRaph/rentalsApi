//Import needed modules.
import { Invoice, Table } from "../classes";
import { Item_binary } from "./item";

//The support of for teh wayer reading and calcltions for consumption, 
export class Item_water extends Item_binary {
    //Init
    constructor(invoice: Invoice) {
        super(invoice, 'wconnection', 'water')
    }

    //Implimenthhte detail poster for the water,:Reurns an sql that is used to help in posting and retirnv of reporting infomation.
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        //The qty of water consumed(the diffence if any)
        const qty = `if(curr.value - prev.value < 0, null , curr.value - prev.value)`
        //rturna checked sql.
        return await this.invoice.check(`
            Select 
                wlink.client,
                wconnection.wconnection,
                wmeter.serial_no as serial_no,
                wmeter.name,
                prev.date as prev_date,
                prev.value as prev_value,
                curr.date as curr_date,
                curr.value as curr_value,
                ${qty} as consumption,
                wconnection.rate,
                wconnection.rate * ${qty} as amount,
                curr.wreading
            From 
                wconnection
                    inner join (${await this.wlink()}) as wlink on
                        wlink.wconnection = wconnection.wconnection
                    left join (${await this.prev_reading()}) as  prev on 
                        prev.wconnection = wconnection.wconnection
                    left join (${await this.curr_reading()}) as curr on
                        curr.wconnection = wconnection.wconnection
                    left join (${await this.posted_items()}) as storage on 
                        storage.wconnection = wconnection.wconnection
                    inner join  wmeter on wconnection.wmeter=wmeter.wmeter
            Where
                ${parameterized ? `wlink.client = ${this.invoice.parameter}` : `true`}
                and wconnection.end_date > '${this.cutoffToString(-2)}'
                and ${postage ? `storage.water is null` : `true`}

        `)
    }

    //Returns the sql to complie the previos reading
    //Unders tood ass the max date less the the cut off
    async prev_reading(): Promise<string> {
        return await this.invoice.check(`
            Select 
                wconnection.wconnection,
                wreading.date,
                wreading.value,
                date.formula
            From 
                wconnection
                inner join wreading on wreading.wmeter = wconnection.wmeter

                inner join (${await this.prev_date()}) as date
                    on date.wconnection = wconnection.wconnection
                    and date.value = wreading.date
        `)
    }

    //Returns the prev date for calculating a reading
    async prev_date(): Promise<string> {
        return await this.invoice.check(`
            Select 
                wconnection.wconnection,
                if(old_date.value is null , old_date.value, new_date.value) as value,
                if(old_date.value is not null, 'old', 'new') as formula
            From 
                wconnection
                left join (${await this.old_prev_date()}) as old_date on
                    old_date.wconnection = wconnection.wconnection
                left join (${await this.new_prev_date()}) as new_date on 
                    new_date.wconnection = wconnection.wconnection
        `)
    }

    //Returns the sql to get the reading of an old client.
    async old_prev_date(): Promise<string> {
        return await this.invoice.check(`
            Select
                wconnection.wconnection,
                max(wreading.date) as value
            From 
                wconnection
                inner join wmeter on wconnection.wmeter=wmeter.wmeter
                inner join wreading on wreading.wmeter=wmeter.wmeter
                inner join(${await this.wlink()}) as wlink
                    on wlink.wconnection =wconnection.wconnection
                    left join (${await this.current_invoice()}) as invoice
                    on invoice.client = wlink.client
            Where
                wreading.date <= '${this.operational_cutoff()}'
                and ${Table.posted('wreading')}
            Group by
                wconnection.wconnection
            `)
    }

    //returns the sql to calculate the new client consumption
    async new_prev_date(): Promise<string> {
        return await this.invoice.check(`
            Select 
                wconnection.wconnection,
                min(Wreading.date) as value
            From
                wconnection
                inner join wmeter on wconnection.wmeter=wmeter.wmeter
                inner join wreading on wreading.wmeter=wmeter.wmeter
            Where
                wreading.date <= '${this.operational_cutoff()}'
                and wreading.date >= '${this.cutoffToString(-2)}'
            Group by 
                wconnection.wconnection
        `)
    }

    async curr_reading(): Promise<string> {
        return await this.invoice.check(`
            Select 
                wconnection.wconnection,
                wreading.wreading,
                wreading.date,
                wreading.value
            From
                wconnection inner join wreading on wreading.wmeter = wconnection.wmeter
                inner join (${await this.curr_date()}) as curr on 
                curr.wconnection = wconnection.wconnection
                and curr.value = wreading.date
        `)
    }

    //Retuns the sql to of the current data for the current reading
    async curr_date(): Promise<string> {
        //A water is stale if
        const stale = `
            last_posted_date.value is null 
            and last_posted_date.value > wreading.date
        `
        return await this.invoice.check(`
            Select
                wconnection.wconnection,
                max(wreading.date) as value
            From
                wconnection 
                inner join wmeter on 
                    wconnection.wmeter = wmeter.wmeter
                inner join wreading on wreading.wmeter = wmeter.wmeter
                inner join (${await this.wlink()}) as wlink on
                    wlink.wconnection = wconnection.wconnection
                left join (${await this.current_invoice()}) as invoice on 
                    invoice.client = wlink.client
                left join (${await this.last_posted_date()}) as last_posted_date on 
                    last_posted_date.wconnection = wconnection.wconnection
            Where
                wreading.date <='${this.operational_cutoff()}'
                and not(${Table.posted('wreading')})
                and not (${stale})
            Group by 
                wconnection.wconnection   
        `)
    }
    //Override the posted items for this item.
    //
    async posted_items(): Promise<string> {
        return await this.invoice.check(`
            Select 
                water.*,
                invoice.client
            From 
                water
                inner join (${await this.current_invoice()}) as invoice
                    on water.invoice = invoice.invoice
        `)
    }
    //
    //Returns the sql for the  
    async wlink(): Promise<string> {
        return await this.invoice.check(`
            Select 
                client.client,
                wconnection.wconnection
            From
                client
                inner join agreement using(client)
                inner join room using(room)
                inner join wconnection using(room)
        `)
    }

    //To post a binary item, three task have to be perfomed
    async post(): Promise<boolean> {
        //query the db for the insertion of the new records to the store table
        const created = await this.invoice.run(`
            Insert into
                water(
                    serial_no, prev_date,curr_date, curr_value,
                    prev_value, consumption, rate, amount,
                    wconnection, invoice
                )
                (
                    Select
                        serial_no, prev_date, curr_date,curr_value,
                        prev_value, consumption, rate, amount,
                        poster.wconnection,
                        invoice.invoice      
                    From
                        (${await this.poster()}) as poster 
                        inner join (${await this.current_invoice()}) as invoice on 
                            invoice.client= poster.client
                    
                )
                On duplicate key update
                        serial_no = values(serial_no),
                        prev_date = values(prev_date),
                        curr_date = values(curr_date),
                        curr_value = values(curr_value),
                        prev_value = values(prev_value),
                        consumption = values(consumption),
                        rate = values(rate),
                        amount = values(amount)
        `)
        //Pefom the second task 
        const update = await this.invoice.run(`
                Update 
                    wreading
                    
                    inner join (${await this.poster()}) as ref on
                        ref.wreading = wreading.wreading
                    inner join (${await this.current_invoice()}) as invoice on 
                        invoice.client = ref.client
                    Set 
                        wreading.invoice = invoice.invoice
                    Where 
                        wreading.invoice is null
                        and wreading.date < ref.curr_date
        `)
        //Check for validi
        if (created && update) return true
        return false
    }

    //Unpost the the item 
    async unpost(): Promise<boolean> {
        //Unpost the water bit with the parent version
        super.unpost();
        //Query the db for the update
        const update = await this.invoice.run(`
            Update
                wreading
            ${this.invoice.current ? `
                    inner join (${await this.current_invoice()}) as invoice
                        on wreading.invoice = invoice.invoice
                ` : ``
            }
            Set 
                wreading.invoice = null
        `)
        //Check for valid.
        if (update) return true
        return false
    }

    async last_posted_date(): Promise<string> {
        return `
            Select 
                wconnection.wconnection,
                max(wreading.date)as value
            From 
                wconnection
                inner join wreading on wreading.wmeter=wconnection.wmeter
                inner join (${await this.wlink()}) as wlink on 
                    wlink.wconnection = wconnection.wconnection
                left join (${await this.current_invoice()}) as invoice
                    on invoice.client = wlink.client
            Where
                wreading.date <= '${this.cutoffToString()}'
                and ${Table.posted('wreading')}
            Group by
                wconnection.wconnection
        `
    }

}