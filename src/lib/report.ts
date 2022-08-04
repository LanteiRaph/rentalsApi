import { Prisma } from "@prisma/client";
import { Options } from "./classes";
import { Poster } from "./poster";
type invoice = {
    primarykey:string
}

//A report class report on the invoice during the month.That means it includes data from the
export class Report extends Poster{
    //Set the where for the 
    where?:string
    //Set the order by 
    orderby?:string
    //Create the report object
    constructor(options:Options){
        //InT the super
        super(options);
        //Over ride the monitor, for report its always true
        this.monitor = true
        //Set the where(poster level set) and order by for the report.
        this.orderby = options.orderby
    }

    //Over ride the report method.
    async report(): Promise<Array<Map<string, any>>> {
        //Start with a empty records array
        const records = Array()
        //Get the driver sql 
        const driver_sql = await this.get_driver_sql()
        //Query the dbase for the records.
        const results: invoice[] = await this.dbase.$queryRaw(Prisma.sql([driver_sql]))
        //step througn the results and for each client create a record with there items
        for (let invoice of results) {
            //set the paraenter for the 
            this.parameter = parseInt(invoice.primarykey)
            //Create a new js Object
            const record: Map<string, any> = new Map()
            //Let i be the ith item
            for (let i of this.items) {
                //Destructu the name of the item and ites values
                const [string, item] = i
                //get the detailed sql for the item
                const detailed = await item.detailed_report()
                console.log(detailed)
                //Query the dbasa for values aganist the sql
                const dbresults = await this.dbase.$queryRaw(Prisma.sql([detailed]))
                //Append the result with the string(item_closing_balance) to the record of the client
                record.set(string, dbresults)
            }
            //append the record to the records
            records.push(record)
        }
        //Retrn the records
        return records
    }

    //Over ride the driver sql for the:A report ids driven by the invoice and the stre table.
    async get_driver_sql(): Promise<string> {
        return await this.check(`
            select 
                invoice.invoice as primarykey,
                client.name
            from 
                invoice 
                inner join client on invoice.client=client.client
                inner join period on invoice.period=period.period
            where
                ${this.where ? `${this.where}`:`true`}
                ${this.orderby ? `${this.orderby}`: ``}
        `)
    }
}