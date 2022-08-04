//Poster reffers to a type of invoice that shows data before being posted.
//Post (Posting) is the act of consuming data to fimulate the charges a tenant needes to pay for a perticulaer month.
//Rent and any other service provides plus adjustement are items that happen after the cuttoff.
//While water and electricty are this consumed the pervius month,understood as arrears
import { Prisma } from '@prisma/client';
import 'datejs'
//
//Create a custome database for testing sqls.
import { Invoice, InvoiceIntereface, Options } from './classes';
import { InvoiceEntity } from './types';
//Response for the user
type PosterRes = string
//Extend the invoice with the poster version.
export interface PosterInterface extends InvoiceIntereface {
    //Add methods needed by the poster 
    post: () => Promise<PosterRes>,
    unpost: () => Promise<PosterRes>
    already_posted: () => Promise<boolean>

}

export interface Driver {
    primarykey:string
}

//Create the poster Object and it functionality.
//A Poster has one or more items to post and report on.
export class Poster extends Invoice implements PosterInterface {
    //Set the order criterisa if any.
    orderby?: string | undefined;

    //init the class with the year and month for the poster.
    constructor(options: Options) {
        super(options)
        //Set the wheere if any sit given
        this.where = options.where
    }
    static init(options:{year:number, month:number}):Poster{
        //
        //Return a new poster with the 
        return new Poster(options)
    }
    async post(): Promise<PosterRes> {
        //check if period is available 
        if (!this.checkPeriod()) return `No period set to post`
        //chekc if period is already posted
        const already_posted = await this.already_posted()
        //Check if data id posted 
        if (already_posted) {
            return 'Data Already posted, Please unpost to post.';
        }
        //post the closing balance first(it depeoned on all the other onces)
        const cb = this.items.get('closing_balance');
        if (cb) cb.post();
        // //Post the rest of the invoice items.
        this.items.forEach(async (item, key) => {
            if (key != 'closing_balance') {
                //Post the rest
                await item.post()
            }
        })
        //Respond back with a sucess message.
        return 'OK, succefully Posted for the month, Check Invoices'
    }

    async already_posted(): Promise<boolean> {
        //get the cuttoff period which i the next, closing balance can only exsit if the next month has an openning balance
        const cutoff_date = this.cutoff(1);
        //Qury the closing balance table to find if any
        //Run a raw query sql 
        const found: [] = await this.dbase.$queryRaw`
                Select
                    closing_balance.amount
                From
                    closing_balance
                    inner Join invoice on closing_balance.invoice=invoice.invoice
                    inner Join period on invoice.period=period.period
                Where
                    period.month=month(${cutoff_date})
                    and period.year=year(${cutoff_date})
            `
        //Check if theres any recor in the found property
        if (found.length >= 1) return true
        //return false if non found 
        return false
    }

    //Unpost the postered data for the given period.
    //Check items for 
    async unpost(): Promise<PosterRes> {
        //check if period is available 
        if (!this.checkPeriod()) return `No period set to post`
        //Check if theres data to unpost if non, respond back.
        if (!this.already_posted()) {
            return 'No Data to Unpost, Please post to unpost again.'
        }
        //TODO: set the current to true {handle current with options but its always true}
        this.current = true
        //Unpost all other item except invoice, its the driver.(foreing key constraint)
        this.items.forEach(async (item, key) => {
            if (key != 'invoice') {
                await item.unpost()
            }
        })
        //Unpost invoice
        const iv = this.items.get('invoice')
        await iv?.unpost()
        //Invoice unposted.
        return 'Unposting done!'
    }

    //Abasract fucntion get_driver sql  the sql that driver the type of invoice
    async get_driver_sql(): Promise<string> {
        //Considr only the non terminated agreements
        const terminated = `
            agreement.terminated is not null
            and agreement.terminated < '${this.cutoffToString()}'
        `;
        //Consier only valid agreemnts
        const valid = ` not (${terminated}) and agreement.valid`
        //
        return await this.check(`
            Select distinct
                client.client as primarykey,
                client.name,
                client.quarterly,
                agreement.terminated
            From 
                client
                inner join agreement
                    on agreement.client = client.client
            Where
                ${valid}
                ${this.where ? `and ${this.where} ` : ``}
            Order by
                client.name
            `)
    }
}