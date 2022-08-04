import { PrismaClient, Prisma } from "@prisma/client";
//Import all neede items for the poster
import {
    Item_water,
    item,
    Item_closing_balance,
    Item_openeing_balance,
    Item_Invoice,
    payament,
    Item_electricity,
    Item_Rent,
    Item_Service, Item_credit, Item_debit
} from './items';
import { InvoiceEntity, I_Invoice } from "./types";


//The expected options to create an invoice to full functionality.
export interface Options {
    year: number
    month: number
    monitor?: boolean
    where?: string
    orderby?: string
}


/**Model The class Needed to handle the busness logic for the rentals application */

//Create a new Prism client, used to handle the creation of connect to db.
const dbase = new PrismaClient();
//
//The invoice model
export interface InvoiceIntereface {
    items: Map<string, item>,
    year: number,
    month: number,
    dbase: PrismaClient,
    current: boolean,
    monitor?: boolean,
    credit: number
    debit: number
    parameter?: number,
    where?: string,
    orderby?: string
    get_driver_sql: () => Promise<string>
    report: () => Promise<Array<Map<string, any>>>
    check: (str: string) => Promise<string>
    run: (str: string) => Promise<boolean>
    cutoff: (n: number) => Date;
    cutoffToString(): string
    //Adhoc solution to migrate graphql data
    setYearAndMonth: (year: number, month: number) => void
}

interface client {
    name: string,
    primarykey: string
}


/**A Table Model a db table most of the methods are static, we want to access them with outside */
export class Table {
    static posted(tname: string): string {
        //a reading is partially posted if
        //theres is a current invoice.
        const partially_posted = `
            invoice.invoice is not null
            and ${tname}.invoice = invoice.invoice
        `
        //
        const posted = `
            ${tname}.invoice is not null
             and not(${partially_posted})
        `
        //Return the posted
        return posted
    }
}



export abstract class Invoice implements InvoiceIntereface {
    //The Year and month associted with the posting
    year: number
    month: number
    //Items to be poested or repotred on
    items: Map<string, item>
    //The Dbas for it(Prismaclint type)
    dbase: PrismaClient
    //set current to true, we are alway reorting for the current period
    current = true
    //an invoice can be used to either monitor or repoert to the user with it set to true we preent data event after possting
    monitor?: boolean
    //used to handle the credit and dep=bit of a client invoice.
    readonly credit = -1
    //The debit for the credit 
    readonly debit = 1
    //Used to bind the report to a specific client when doing reporting 
    parameter?: number
    //Proived criteria to filter the driver sql 
    where?: string
    //Record represent data retrived for the data based to used for query by graphql or anyther 
    //query language or uasge as fit 
    records?: Array<Map<string, I_Invoice>>

    //Initialize the classs with the optiosn given:Year an Month Must be provieded.
    constructor(options: Options) {
        //Set the year and the month
        this.year = options.year
        this.month = options.month
        //Create the dbase associated with the poster
        this.dbase = dbase
        //An empty Item list
        this.items = new Map();
        //add items to the item list: A record is a collection of itmes
        this.create_record();
    }

    async getItemValues<T>(name:string, driver:string): Promise<Array<T>>{
        //set the parameter to avaid sql failer
        this.parameter =  parseInt(driver)
        //Set the year and the month
        this.setYearAndMonth(2022, 7)
        //Find the item by name.
        const item = this.items.get(name);
        //Get the sql for the item detal poster.
        const sql = await item?.detailed_poster(true, false) as string
        //Query th db for values agnist the sql.
        const records: T[] = await this.dbase.$queryRaw(Prisma.sql([sql]));
        //Return the records given.
        return records
    }

    setYearAndMonth(year: number, month: number): void {
        //set the year and month
        this.year = year
        this.month = month
    };

    checkPeriod(): boolean {
        if (this.year && this.month) return true
        return false
    }
    //Every Type of invoice is driven by a specific table 
    //Returns the sql for the driver table plus a primarykey to bind the paramenter.
    abstract get_driver_sql(): Promise<string>;
    //Report the potser before and after it is posted,
    //This method uses the parametrized to rertun and array of client objects
    //that represent the invoice before and after being posted
    async report(): Promise<Array<Map<string, any>>> {
        //Start with a empty records array
        const records = Array()
        //Get the driver sql 
        const driver_sql = await this.get_driver_sql()
        //Query the dbase for the records.
        const results: client[] = await this.dbase.$queryRaw(Prisma.sql([driver_sql]))
        //step througn the results and for each client create a record with there items
        for (let client of results) {
            //set the paraenter for the 
            this.parameter = parseInt(client.primarykey)
            //Create a new js Object
            const record: Map<string, any> = new Map()
            //Let i be the ith item
            for (let i of this.items) {
                //Destructu the name of the item and ites values
                const [string, item] = i
                //get the detailed sql for the item
                const detailed = await item.detailed_poster(true, true)
                //console.log(detailed)
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

    //A record represnet all the items in the poster, its an array of all the items the 
    //poster manages and repost on
    create_record(): void {
        //Step thrpuh ght news creating aporties classs that match them
        //Add the opeing balance of the 
        this.items.set('opening_balance', new Item_openeing_balance(this))
        //Add the client item
        this.items.set('invoice', new Item_Invoice(this))
        //Create the item rent
        this.items.set('rent', new Item_Rent(this))
        //Add the water item
        this.items.set('water', new Item_water(this))
        this.items.set('power', new Item_electricity(this))
        //Add the payment for the client
        this.items.set('payment', new payament(this))
        this.items.set('services', new Item_Service(this))
        //adjust ments
        this.items.set('credits', new Item_credit(this))
        this.items.set('debits', new Item_debit(this))
        //asdd th  cloeing balance
        this.items.set('closing_balance', new Item_closing_balance(this))
    }

    //Check an sql for any errors, use the executeraw to retun a number if an sql is valid
    async check(sql: string): Promise<string> {

        //Create a new  Prims sql: Used to manage the sql 
        const chcksql = Prisma.sql([sql])
        //Perfome and executionto check for errors.
        await this.dbase.$executeRaw(chcksql)
        //Return the sql string from the sql object
        return chcksql.sql
    }

    //
    //Creates a primsa sql and execute: used for inserts and update
    async run(sql: string): Promise<boolean> {
        //Create a new prisma 
        const sqlToRun = Prisma.sql([sql]);
        //execute the sql 
        if (await this.dbase.$executeRaw(sqlToRun)) return true
        return false
    }

    //Returns the cutoff pereiod to poste and unpost data for
    cutoff = (n = 0) => {
        //Let $day0 be the first day of the current period.
        const day0 = `${this.year}-${this.month}-01`
        //Create a mew Date fromt first day of the month
        const date = new Date(day0);
        //Add the cutoff value to obtain the corret date
        //Formulate the date expression of the dayn e.g '2019-02-3 + 4 months'
        date.addMonths(n)
        //return the last dat of he month as the cuttoff
        return date.moveToLastDayOfMonth()
    }
    //Returns string Version of the current cutoff date
    cutoffToString(n = 0): string {
        let today = this.cutoff(n);
        let dd = String(today.getDate()).padStart(2, '0');
        let mm = String(today.getMonth() + 1).padStart(2, '0'); //janvier = 0
        let yyyy = today.getFullYear();

        return yyyy + '-' + mm + '-' + dd;
    }
}