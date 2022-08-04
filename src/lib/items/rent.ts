//Compile the rent item, this item is the focus of the system a car should be taken on the implimnetation of ite.
import 'datejs'
import { Invoice } from '../classes';
import { Item_binary } from "./item";

export class Item_Rent extends Item_binary{
    //Create the item with the parent invoice
    constructor(invoice:Invoice){
        super(invoice, 'agreement', 'rent');
        //Rent is paid in advance 
        this.advance = true
    }

    //Complie and retuen a detailed sql for posting the item
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        //
        //Compute the rent conversion factor, e.g., 1 for monthly paying clients,
        //3 for quarterly paying clients when due and null for non-due cases.
        //
        //Quarterly clients pay after every 3 months, so they pay 3 times their
        //monthly rent on the fall of each quarter and null otherwise.
        //
        //The fall of a quarter occurs when...
        const fall = `((month(agreement.start_date)- ${this.invoice.month})% 3) = 0`
        //if quality
        const quarterly = `if(${fall}, 3, null)`
        //compile the factor of multiplication
        const factor = `if(client.quarterly, ${quarterly}, 1)`
        //The firts day of the month of the rental period
        const firstday = `${this.invoice.year}-${this.invoice.month}-01`
        //Local function to return the month name for the firts of the current period
        const month = (n:number, firstday:string)=> {
            //Create a new date 
            let date = new Date(firstday)
            //Add the n number of months to the current date
            const date_ = date.addMonths(n)
            return date_.toLocaleString('en-us', {month: 'long'})
        }
        //join the next 3 months 
        const month3 = `${month(0, firstday)}, ${month(1, firstday)}, ${month(2, firstday)}`
        //For the quartterly clientsif the quakter is due return the next three month 
        //otherwise retun the current on
        const period = `if(client.quarterly and (${fall}), '${month3}', '${month(0,firstday)}')`
        //Return a checked sql 
        return await this.invoice.check(`
                Select 
                    agreement.client,
                    agreement.agreement,
                    room.uid as room_no,
                    agreement.amount as price,
                    ${factor} as factor,
                    ${period} as rental_period,
                    agreement.amount * (${factor}) as amount,
                    agreement.start_date as agreement_start_date
                From
                    agreement
                    left join (${await this.posted_items()}) as rent
                    on rent.agreement=agreement.agreement
                    inner join client on agreement.client=client.client
                    inner join room on agreement.room = room.room
                Where
                    ${parameterized ? `agreement.client = ${this.invoice.parameter}`: `true`}
                    and agreement.amount is not null
                    and (${postage ? `rent.agreement is null`: `true`})
                    and agreement.terminated is null
                    and agreement.start_date<='${this.cutoffToString()}'
                Order by
                    agreement.start_date, agreement.amount desc
        `)
    }
    //
    //Over ride the posted items to obtain unique value for tthis item
    async posted_items(): Promise<string> {
        return this.invoice.check(`
                Select 
                    rent.rent,
                    rent.agreement
                From
                    rent
                    inner join (${await this.current_invoice() }) as invoice on 
                        rent.invoice = invoice.invoice
        `)
    }

    //Posting a rent item involve creating new record in the store
    async post(): Promise<boolean> {
        //Retun an 
        return this.invoice.run(`
            Insert Into 
                rent
                (   
                    room_no, 
                    price, 
                    agreement_start_date, 
                    rental_period,
                    factor, 
                    amount, 
                    agreement, 
                    invoice
                )
                (
                    Select 
                        room_no, 
                        price, 
                        agreement_start_date,
                        rental_period,
                        factor, 
                        poster.amount,
                        poster.agreement,
                        invoice.invoice
                    From    
                        (${await this.poster()}) as poster
                        inner join (${await this.current_invoice()}) as invoice
                            on invoice.client = poster.client
                        inner join agreement on agreement.agreement=poster.agreement

                    Order By 
                        agreement.start_date
                )
            On duplicate key update
                room_no = values(room_no),
                price=values(price),
                rental_period=values(rental_period),
                factor=values(factor)
        
        `)
    }
}