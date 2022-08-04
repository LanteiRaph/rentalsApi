//This class supports management of chargeable, monthly services that are not 
//covered by rental, water or electricity charges. Identifying and delivering 
//these services should be a core business of a rental system to promote client
//satisfaction. The current services for Mutall include:-
//
//. security
//. gabbage collection.
//
//The following servics are in the planning stages:-
// 
//. IT consultations
//. Stand-by power supply
//
//The model to support these and future services comprises of the following 
//entities:-
//. service(name*, price, auto)
//. subscription(service*, client*, factor)
//. charge(servive*, period*, amount) 
//
//Notes:-
//(i) The cost of a service is calculated in 2 ways:- 
//
//a) charge = subscription.factor * service_type.price or
//b) charge = service_type.price
//
//depending on whether the servce is automatic or not.
//Formula a) is suplied if the service is subscribed. This method is used to levy
//non-standard charges to selected clients
//Formula be is used if a service is automatic and ahas not been subscribed.
//subscriibed.
//If a service is not automatic and has not been subscribed, e.g., water charges
//then other criteria must be used for calculating the charge. That becomes a new
//item that is driven by client, usses charge as the storage and uses water meter
//connection to pick out shich clents to charge.
//
//The subscription factor is estimated by a joint assessment when a client is
//registered, but can be altered during rent life when the service usage is 
//better estimated. This fact is used to adjust charges on after the 3rd year of 
//client occupancy
//
//Service is a binay item because it is pposting it involves 2 tables: the client

import { Invoice } from "../classes";
import { Item_binary } from "./item";

//as the driver and the charge as the storage for the posted erecords.
export class Item_Service extends Item_binary{

    constructor(invoice:Invoice){
        super(invoice, 'client', 'charge');
        //Srvie are paid in advance
        this.advance = true
    }

    //Checkas if a service has been posted for the current period
    async posted_items(): Promise<string> {
        return await this.invoice.check(`
            Select
                charge.*,
                invoice.client
            From
                charge
                    inner join (${await this.current_invoice()}) as invoice on
                        charge.invoice = invoice.invoice        
        `)
    }
    //returns the all th unclasified 
    async detailed_poster(parameterized?: boolean, postage?: boolean): Promise<string> {
        //Compile the two ways of calculating a charge
        const ca = `subscription.subscription is not null`
        const a = `subscription.amount`
        //B 
        const cb = `subscription.subscription is null and service.auto`
        const b =`service.price`
        //when no of the condition suplly th servie charge
        const price = `if(${ca}, ${a}, if(${cb}, ${b}, null))`
        //The fall of a qualter occure when 
        const fall = `((month(agreement.start_date) - ${this.invoice.month}) %3) = 0`;
        //
        const quarterly = `if(${fall}, 3, null)`
        //Compile he facyro of multilication
        const factor = `if(client.quarterly, ${quarterly}, 1)`
        //Calculate the amount for the charge 
        const amount = `${price} * ${factor}`
        //retun a checked sql for the detail poster
        return await this.invoice.check(`
            Select
                service.name,
                ${price} as price,
                ${factor} as factor,
                ${amount} as amount,
                client.client,
                service.service
            From
                client
                join service 
                left join subscription on subscription.service = service.service
                and subscription.client = client.client
                left join (${await this.posted_items()}) as charge 
                on charge.service = service.service
                and charge.client = client.client
                left join (${await this.agreement()}) as agreement on
                    agreement.client = client.client
            Where
                ${parameterized ? `client.client = ${this.invoice.parameter}`: `true`}
                and ${postage ? `charge.charge is null` : `true`}
                and ${amount} is not null
                and agreement.start_date >= ${this.invoice.cutoffToString()}
        `)
    }

    async agreement():Promise<string>{
        return await this.invoice.check(`

            Select 
                agreement.client,
                min(agreement.start_date) as start_date
            From
                agreement
            Group by 
                agreement.client
        `)
    }

    async post(): Promise<boolean> {
        return await this.invoice.run(`
            Insert Into 
                charge(
                    name,
                    price,
                    factor,amount,
                    invoice,service
                )
                (
                    Select
                        poster.name,
                        poster.price,poster.factor,poster.amount, invoice.invoice
                    From
                        (${await this.poster()}) as charge 
                        inner join (${await this.current_invoice()}) as invoice
                        on invoice.client= poster.client
                )    
            On duplicate key update
                    name=values(name)
                    amount=values(amount)
        `)
    }

}