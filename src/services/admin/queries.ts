import {
    extendType,
    nonNull,
    objectType,
    stringArg,
    intArg,
    inputObjectType,
    enumType,
    arg,
    list,
} from "nexus";
import { resolve } from "path";

import { Poster } from '../../lib/poster'
import { InvoiceEntity } from "../../lib/types";


//Lisrt Applivcation for listing table one infomaion
//Compile the modules needed to handle the admin panel 
export const Clients = extendType({
    type: 'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('clients', {
            type: 'client',
            async resolve(prt, args, cxt) {
                //Return all clients in the database.
                return await cxt.db.client.findMany()
            }
        })
    }
})


export const Payments = extendType({
    type:'Query',
    definition(t) {
        t.nonNull.list.nonNull.field('payments', {
            type:'Payment',
            async resolve(prt, args,cxt){
                return await cxt.db.payment.findMany({
                    orderBy:{
                        date:'desc'
                    }
                }) as []
            }
        })
    },
})
