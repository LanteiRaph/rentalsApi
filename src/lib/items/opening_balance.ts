import { Invoice } from '../classes';
import { Item, Item_unary } from './item'
//An openning balance is special item thta invlove s two items 
//Auto_balance
//manual-balance
//where an auto abalanace is a type of balance that is drived by the closing balance
//Consumption of data to create a closing balance
//Manula: User given balanaces that are written itno the system.
//If both are avaialbe and are not equal to eah other it creats an inconssistencesy
export class Item_openeing_balance extends Item {
    //The initial balance tem for the client
    initial: Item_initial_balance
    //The auto calculated baance
    auto: Item_auto_balance
    //Init the item with the invoice parent
    constructor(invoice: Invoice) {
        super(invoice, 'client')
        //Set the auto and inital balance for the item
        this.auto = new Item_auto_balance(invoice);
        this.initial = new Item_initial_balance(invoice);
    }
    async post(): Promise<boolean> {
        const auto = await this.auto.post()
        const initial = await this.initial.post()
        if (auto && initial) {
            return true
        }
        return false
    }
    async unpost(): Promise<boolean> {
        const auto = await this.auto.unpost()
        const initial = await this.initial.unpost()
        if (auto && initial) {
            return true
        }
        return false
    }
    //return the sql for posting (retrive data) 
    //
    async detailed_poster(parameterized: boolean, postage: boolean): Promise<string> {
        //define and report the descrepancy
        const discrepancy = `
            initial.amount is not null
            and auto.amount is not null
            and not(auto.amount = initial.amount)
        `
        //Condition the balance to be repoted, report what is there
        const balance = `if(auto.amount is null, initial.amount, auto.amount)`
        //Apply the discrepnacy condition, if availbe take the auto version for consistenct of closing balance
        const amount = `if(${discrepancy}, initial.amount, ${balance})`
        //Compile the date for the 1st of the current period
        const date = `${this.invoice.year}-${this.invoice.month}-01`;
        //Compile the sql to return
        const sql = `
            Select
                '${date}' as date,
                ${amount} as amount,
                client.client
            From
                client
                left join (${await this.initial.detailed_poster(parameterized, postage)}) 
                as initial on initial.client=client.client
                left  join (${await this.auto.detailed_poster(parameterized, postage)})
                as auto on auto.client=client.client
            Where
                (${parameterized ? `client.client=${this.invoice.parameter}` : "true"})
                and not (auto.amount is null and initial.amount is null)
        `
        const checked_sql = await  this.invoice.check(sql)
        //return the checked sql.
        return checked_sql
    }
    //Returns the sql to be used for reporting
    async detailed_report(parameterized = true, postage = true):Promise<string> {
        //Compile the sql:A union of both the auto and the inital balances
        const sql = `
            Select
                initial.amount
            From
                (${await this.initial.detailed_poster(parameterized, postage)}) as initial
            Union All
            Select 
                auto.amount
            From 
                (${await this.auto.detailed_poster(parameterized, postage)}) as auto
        
        `
        //Check the sl for errors:Avoid error that are unknow(had to debug)
        await this.invoice.check(sql)
        //If we get here we have no error the sql passed. 
        return sql
        
    }
}


//This clasas models the initial openeing balance of the client 
//this balance are anuly fed in t the sytem and they are adjust to match the current cutoff of th period.
class Item_initial_balance extends Item_unary {
    constructor(invoice: Invoice) {
        super(invoice, 'balance_initial')
    }
    
    //retusn thr sql for the initla balance posting 
    async detailed_poster(parameterized: boolean, postage: boolean): Promise<string> {

        const sql = `
            Select 
                balance_initial.date,
                balance_initial.amount,
                balance_initial.client,
                balance_initial.balance_initial
            From
                balance_initial
            Where
                (${parameterized ? `balance_initial.client=${this.invoice.parameter}` : "true"})
                and (${postage ? "balance_initial.invoice is null" : 'true'})
                and month(balance_initial.date) = month('${this.cutoffToString()}')
                and year(balance_initial.date) = year('${this.cutoffToString()}')
        `
        //Check for any errors in the sql.
        return await this.invoice.check(sql)
    }
    //Posting the initla balance means perfimg two tasks
    //1. Link the balance to the current invoice
    //2. Link any earlier unposted items to the current invoice
    async post(): Promise<boolean> {
        //Query the database with an update to the balance initial to perfom task 1
        const balanceUpdate = await this.invoice.run(`
            Update
                balance_initial
                inner Join (${await this.poster()}) as poster on 
                    balance_initial.balance_initial = poster.balance_initial
                inner join (${await this.current_invoice()}) as invoice on
                    balance_initial.client=invoice.client
            Set
                balance_initial.invoice = invoice.invoice
        `)
        //query the dbase to perfom task 2.
        const earlierUpdate = await this.invoice.run(`
            Update
                balance_initial as earlier
                inner join balance_initial as ref
                    on earlier.client = ref.client
                inner join (${await this.detailed_poster(false, false)}) as poster
                    on poster.balance_initial = ref.balance_initial
            Set
                earlier.invoice = ref.invoice
            Where
                earlier.date < ref.date
                and earlier.invoice is null 
        `)
        //Check of the balanceInitial was foun
        if(balanceUpdate && earlierUpdate) return true
        //Always retrun fasle 
        return false
    }
    //Unposting is the reverse of posting
    //1. Unlike any balance liked to the current invoice 
    //Deliend any earlir ones as weell
    //2. offset theclosing-balance to unposted
    async unpost(): Promise<boolean> {
        
        //query the dabse for tsk 1.
        const unlinkedBalances = await this.invoice.run(`
            Update
                balance_initial
                ${this.invoice.current ? `
                inner join (${await this.current_invoice()}) as invoice
                    on balance_initial.invoice = invoice.invoice
                 ` : ""}
                Set
                    balance_initial.invoice = null
        `)
        //Off set the flad
        const unFlaged = await this.invoice.run(`
            Update
                closing_balance
                    ${this.invoice.current ? `
                        inner join (${await this.current_invoice()}) as invoice on 
                            closing_balance.invoice = invoice.invoice
                    ` : ``}
                set
                    closing_balance.posted = false
        `)
        //Test for success
        if(unlinkedBalances && unFlaged) return true
        //Always return false
        return false
    }
}

class Item_auto_balance extends Item_unary {
    constructor(invoice: Invoice) {
        super(invoice, 'closing_balance')
    }
    //rertusn the sql used to post this item,i.e, data that will be posted
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        const sql = ` 
            Select
                closing_balance.amount,
                invoice.client
            From
                closing_balance
                inner join (${await this.current_invoice()}) as invoice
                    on invoice.invoice = closing_balance.invoice
            Where
                (${parameterized ? `invoice.client = ${this.invoice.parameter}`: "true"})
                and (${postage ? "not(closing_balance.posted)" : "true"})
        `

        await this.invoice.check(sql)
        //Return the sql
        return sql
    }
    //Poste the item: Perom an update for the posted filed
    async post(): Promise<boolean> {
        //
        const updatedPosted = await this.invoice.run(`
            Update
                closing_balance

                inner join (${await this.current_invoice()}) as invoice
                    on invoice.invoice=closing_balance.invoice

                inner join (${await this.poster()}) as poster
                    on poster.client=invoice.client
                Set
                    closing_balance.posted = true
        `)
        //Check for 
        if(updatedPosted) return true
        //always return fasle
        return false
    }
    //Unpost
    async unpost(): Promise<boolean> {
        console.log('unposting')
        //Query the dbase for and update on the clising balance marking the as unposted
        const updatedPosted = await this.invoice.run(`
            Update
                closing_balance
                ${this.invoice.current ? ` inner join (${await this.current_invoice()}) as invoice
                    using(invoice)
                `: ``}
            Set 
                closing_balance.posted = false
        `)
        //Check 
        if(updatedPosted) return true
        return false 
    }

}