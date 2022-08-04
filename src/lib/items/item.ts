//The item object represent the support for posting, unposting
//The dta to post must be driven form an enetity in database call a driver.
import { Invoice } from "../classes"

//Item Type
export interface item {
    invoice: Invoice,
    driver: string,
    aesthetics: boolean,
    is_credit: boolean,
    advance: boolean,
    initial?: item,
    auto?: item,
    post: () => Promise<boolean>,
    unpost: () => Promise<boolean>,
    detailed_poster: (parameterized: boolean, postage: boolean) => Promise<string>
    detailed_report: () => Promise<string>
    operational_cutoff: (n: number) => string
}

/**Model an item: This represnets a collumn on a invoice table eg rent:amount
 * 
 * There are two types of Items;
 * itmes that store data and retrive from diffrent table: Item binary
 * Items that store and retrive data from the same table:item Unary
 * params:Invoice:Parent, driver table
 */
export abstract class Item implements item {

    //Optional for children that extend this item 
    storage?: string
    //Parernt record for the item
    invoice: Invoice
    //The driver tabel
    driver: string
    //Indcates f the item pertakes in making the closing balance
    aesthetics: boolean
    //Indicte whether this item credit the invoice or not, only payment and credits do
    is_credit: boolean
    //The item is either an advance such as rent and servrvice or an arrear such as water
    advance: boolean

    //An item is underestto dby its parent rcord and the driver table
    constructor(invoice: Invoice, driver: string) {
        //Set the parent record
        this.invoice = invoice
        //Set the driving table
        this.driver = driver
        //Set aesthetis to false all items are nned for comutng invoice
        this.aesthetics = false
        //set  is credit to flase
        this.is_credit = false
        //All payments and expences are in arrears, except rent and services 
        //which are paid in advance
        this.advance = false
    }

    //The Post methed for each item. Each item will handle it post feature
    //Posting is creating record or linking records in the data model in the given period.
    abstract post(): Promise<boolean>
    //Unpost the current item
    abstract unpost(): Promise<boolean>
    //Returns the sql sed to collect data for storage.
    abstract detailed_poster(parameterized: boolean, postage: boolean): Promise<string>;
    //Impliment the get report sql, this sql report for the sore tables, no clalculations is needed.
    async detailed_report(parametarized = true): Promise<string>{
       return `select * from rent`
        //Return a checked sql
        // return await this.invoice.check(`
        //     Select 
        //         ${this.storage}.*
        //     From
        //         ${this.storage} 
           
        
        // `)
    }
    //Returns string Version of the current cutoff date
    cutoffToString(n = 0): string {
        return this.invoice.cutoffToString(n)
    }
    //Returns the sql for the posted items
    async posted_items(): Promise<string> {
        return await this.invoice.check(`
            Select 
                ${this.storage}.*,
                invoice.client
            From
                ${this.storage}
                inner join (${await this.current_invoice()}) as invoice
                on ${this.storage}.invoice = invoice.invoice  
        `)
    }
    //Retuns the sql that check the current period invoice
    async current_invoice(): Promise<string> {
        return await this.invoice.check(`
            Select 
                invoice,
                invoice.client,
                invoice.period
            From
                invoice
                inner join (${await this.current_period()}) as period
                on invoice.period = period.period
        `)
    }
    //Retuns the sql accocied with the current period
    async current_period(): Promise<string> {
        return await this.invoice.check(`
            Select 
                *
            From 
                period
            Where
                period.year = year('${this.cutoffToString()}')
                and period.month = month('${this.cutoffToString()}')
        `)
    }
    //Returns the sql for posting this item.
    //depens on two other sqls the poster driver sql and the detailed poster
    async poster(postage = true): Promise<string> {

        //Get the driver sql
        const driver = await this.invoice.get_driver_sql();
        //
        //Get the detailed sql
        const detailed = await this.detailed_poster(false, postage);
        //Compile the sql to exceute
        return await this.invoice.check(`
            Select
                detailed.*
            From
                (${driver}) as driver
                inner join (${detailed}) as detailed
                on driver.primarykey = detailed.client
        `)
    }
    //Return the current cutoff for the item to use 
    cutoff(n = 0): Date {
        return this.invoice.cutoff(n)
    }
    //Does the item yake part in moniot report? if so, its cutoff need to be adjusted, so that data for the invoice period are included or excluded
    operational_cutoff(n = 0): string {
        const x = this.invoice.monitor ? n : n - 1;
        return this.cutoffToString(x)
    }
}

//This type of item sores data to and diffrent table than its driver
//It resucres a stroeege table
export class Item_binary extends Item {

    //Initialize the class with a record parent and a driver with the addition of store that 
    //represents the bale to which we save the posted datad
    constructor(invoice: Invoice, driver: string, store: string) {
        //Creat the parent class
        super(invoice, driver)
        //Set the stroege for the cureent item
        this.storage = store
    }
    //Impliment the post method for this kild of items.
    async unpost(): Promise<boolean> {

        //Try to avoid the chance of failing.
        const deleted = await this.invoice.run(`
                Delete
                    ${this.storage}.*
                From 
                    ${this.storage}
                ${this.invoice.current ? `inner join (${await this.current_invoice()}) as invoice on
                    ${this.storage}.invoice = invoice.invoice
                ` : ``} 
            ` )
        if (deleted) return true
        return false
    }
    //Impliment the unpost feature for this kind of items
    async post(): Promise<boolean> {
        return false
    }
    //Implimnet the detailed poster sql for the item
    async detailed_poster(parameterized = true, postage = true): Promise<string> {
        return ``
    }
}
//
//A Unary item is an item where the store and thr driver are the same.
export class Item_unary extends Item_binary {
    constructor(invoice:Invoice, driver: string) {
        //Create the parent class
        super(invoice, driver, driver);
        //Appened any class properties
    }
    //Override the post method to handle this type of posting
    //Which involves the creatiin of a link with the current item.
    //This type of items have a date to them to which they falll undr the cuttoff date
    async post(): Promise<boolean> {
        //Query the dbae wwith an update to the storeae table 
        const updatedstore = await this.invoice.run(`
            Update
                ${this.storage}
            
                inner join (${await this.poster()}) as poster 
                    on poster.${this.storage} = ${this.storage}.${this.storage}
                    inner join (${await this.current_invoice()}) as invoice
                        on ${this.storage}.client = invoice.client
            Set 
                ${this.storage}.invoice = invoice.invoice
                `)
        //Check foe validity
        if (updatedstore) return true
        return false
    }
    //Override the unpost method
    //Unposting means we delink the ite from the invoice
    async unpost(): Promise<boolean> {
        const unlinked = await this.invoice.run(`
            Update
                ${this.driver}
             ${this.invoice.current ? `
                    inner join (${await this.current_invoice()}) as invoice on
                    ${this.driver}.invoice = invoice.invoice
                ` : ``
            }
            Set 
             ${this.driver}.invoice = null
        `)
        //Check for validitity
        if (unlinked) return true
        return false
    }
    //Implimnet the detailed poster sql for the item
    async detailed_poster(parameterized = true, postage = true): Promise<string> {
        //Retne a compilesd sql 
        return ``
    }
}