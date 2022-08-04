/*
This class manages electricity charges, to Mutall clients, computed from 
Kenya Power bills, or estimated from our own local readings. The last option is
not implemented yet. For KPLC billing, the following figure represents possible 
billing scenarios, where:-
ui = the i'th unposted billing date
pj = the j'th posted billing date
c = the cutoff date, i.e., the last day of the current invoice period.

Figure 1: Bill posting  scenarions
 
-----v---v---v----------v---------------v---------v----------v-------p--
     u1  p1  u2         p2              u3        c          u4      p3

Question: what is the bill to charge the client for period c, u1..u4?
 
Intuitively, it is u3, where:- 
1. the bill is unposted, so it cannot be any of the pi's
2. the billing date is:-
    a. below or equal to to the cutoff, so u4 is out, leaving [u1, u2, u3]
    b. the highest below the cutoff date
    c. higher than p2 where p2 is a posted bill with the highest date below
       the cutoff -- if p2 exists.
Bill u3 may be divided between a number of clients, depending on whether it is 
shared or not, to arrive at a, the amount to be charged. The charge is 0 if 
there is not sharing, as these clients pay directly to Kenya power

To simplify the logic for selecting teh appropriate bill to charge at any time,
we assume that if a bill is bosted, the all the raelier unposted ones will 
be marhes as posted. This means that in figure 1, bills u1 and u2 would all have
been flagged as posted because they are earlier than p2
*/
//
//Electricity is a billed binary item. This means a number of things:-
//a) Posting requires 2 operands: eaccount as the driver and elecricity as the
//  storage
//b) It is a time variant quantity where the ebill entity changes from month to
//month

import { Table, Invoice } from "../classes";

import { Item_binary } from "./item";


export class Item_electricity extends Item_binary{
    constructor(invoice:Invoice){
        super(invoice, 'eaccount', 'electricity')
    }

    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        //Compute the amount to be shown on the clients invoice,
        const charge = `if(membership.count > 1, ebill.current_amount*(power.share/membership.total_share),null)`;
        //
        return await this.invoice.check(`
            Select
                eaccount.num as eaccount_no,
                emeter.new_num as emeter_no,
                ebill.current_amount as payable_to_kplc,
                ebill.due_date,
                concat(power.share, '/', membership.total_share) as sharing,
                ${charge} as amount,
                power.client,
                eaccount.eaccount,
                ebill.ebill
            From
                eaccount
                inner join (${await this.power()}) as power on 
                    power.eaccount=eaccount.eaccount
                left join (${await this.membership()}) as membership on 
                    membership.eaccount = eaccount.eaccount
                left join (${await this.last_unposted_bill()}) as ebill on
                    ebill.eaccount = eaccount.eaccount
                left join (${await this.posted_items()}) as electricity on
                    electricity.eaccount = eaccount.eaccount
                    and electricity.client = power.client
                inner join elink on elink.eaccount=eaccount.eaccount
                inner join emeter on emeter.emeter=elink.emeter
            Where
                ${parameterized ? `power.client= ${this.invoice.parameter}` : `true`}
                and ${postage ? `electricity.electricity is null` :`true`}
        `)
    }
     //Posting electricity charges involves the following operations for the 
    //current period:-
    //a) creating the electricity charge record using a referenece bill
    //b) linking ref bill to the invoice
    //c) linking all unposted bills ealier than the ref to the invoice
    
    async post(): Promise<boolean> {
        const elect = await this.invoice.run(`
            Insert Into 
                electricity(
                    eaccount_no, 
                    emeter_no, 
                    payable_to_kplc, 
                    sharing , due_date,
                    amount, eaccount, invoice)
                    (
                        Select 
                            eaccount_no, emeter_no,payable_to_kplc, sharing,due_date,
                            amount,poster.eaccount, invoice.invoice
                        From
                            (${await this.poster()}) as poster
                            inner join (${await this.current_invoice()}) as invoice
                                on invoice.client=poster.client
                    )
            On duplicate key update
                eaccount_no=values(eaccount_no),
                emeter_no=values(emeter_no),
                due_date=values(due_date),
                payable_to_kplc=values(payable_to_kplc),
                sharing=values(sharing),
                amount=values(amount)
        `)
        //Update the ebill to make all values unner the cutoff as posted
        const updated = await this.invoice.run(`
                Update
                        ebill
                    inner join (${await this.detailed_poster(false,false)}) as poster on 
                        ebill.ebill= poster.ebill
                    inner join (${await this.current_invoice()}) as invoice on 
                        invoice.client = poster.client
                Set
                    ebill.invoice = invoice.invoice
        `)
        //Update the bill earler as well 
        const earlier = await this.invoice.run(`
            Update 
                ebill as ref
                inner join(${await this.detailed_poster()}) as e on
                    ref.ebill = e.ebill
                inner join ebill as earlier
                        on earlier.eaccount = ref.eaccount
            Set
                earlier.invoice = ref.invoice
            Where
                earlier.invoice is null
                and earlier.due_date < ref.due_date
        `)
        if(elect && updated && earlier)return true
        return false
    }
    //Unpost revers the posting process
    async unpost(): Promise<boolean> {
        const updated =  await this.invoice.run(`
            Update
                ebill
                ${this.invoice.current ? `
                    inner join (${await this.current_invoice()}) as invoice on
                        invoice.invoice = ebill.invoice
                `: ``}
            Set 
                ebill.invoice = null
        `)
        const parent = await super.post()
        if(updated && parent) return true
        return false
    }

    //Let 'power' be a virtual entity that models the link between client and 
    //eaccount tables with client and eaacount as the identifisrs
    async power():Promise<string>{
        //terminated 
        const terminated = `
            agreement.terminated is not null
            and agreement.terminated < '${this.invoice.cutoffToString()}'
        `
        //
        const futureistc = `agreement.start_date>'${this.invoice.cutoffToString()}'`
        const valid_agreemenet = ` not (${terminated}) and agreement.valid and not(${futureistc})`
        return this.invoice.check(`
            Select distinct
                client.client,
                eaccount.eaccount,
                client.name,
                if(econnection.share is null, 1,econnection.share) as share
            From
                client
                inner join agreement on agreement.client=client.client
                inner join room on agreement.room = room.room
                inner join econnection on econnection.room = room.room
                inner join emeter on econnection.emeter=emeter.emeter
                inner join elink on elink.emeter=emeter.emeter
                inner join eaccount on elink.eaccount = eaccount.eaccount
            Where
                ${valid_agreemenet}
                and econnection.end_date>='${this.cutoffToString()}'
        `)

    }
    //Use the power to eastablish membership,how many are sharing
    async membership():Promise<string>{
        return await this.invoice.check(`
            Select 
                power.eaccount,
                sum(power.share) as total_share,
                count(power.client) as count
            From
                (${await this.power()}) as power
            Group by
                power.eaccount
        `)
    }
    //last unposted ebill a the one with the last poasted data
    async last_unposted_bill():Promise<string>{
        return this.invoice.check(`
            Select 
                ebill.*
            From
                ebill
                inner join (${await this.last_unposted_date()}) as last_date on 
                    last_date.value = ebill.due_date
                    and last_date.eaccount= ebill.eaccount

        `)
    }
    async last_unposted_date():Promise<string>{
        return await this.invoice.check(`
            Select
                max(ebill.due_date) as value,
                power.eaccount
            From
                (${await this.power()}) as power
                inner join ebill on ebill.eaccount = power.eaccount
                left join (${await this.current_invoice()}) as invoice on 
                    invoice.client = power.client
            Where
                ebill.due_date <= '${this.operational_cutoff()}'
                and not(${Table.posted('ebill')})
            Group by
                power.eaccount
        `)
    }

    async posted_items(): Promise<string> {
        return await this.invoice.check(`
            Select 
                electricity.electricity,
                electricity.eaccount,
                invoice.client
            From
                electricity
                inner join (${await this.current_invoice()}) as invoice on
                    electricity.invoice = invoice.invoice
        `)
    }
}