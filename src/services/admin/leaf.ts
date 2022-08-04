import { list, objectType, stringArg } from "nexus";

export const Client = objectType({
    name: 'client',
    definition(t) {
        t.int('client');
        t.string('name');
        t.string('email');
        t.string('phone');
        t.list.field('agreement', {
            type:'Agreement', 
            async resolve(prt, args, cxt){
                const agreements  = await  cxt.db.client.findUnique({where:{
                    client: (prt.client as number)
                }}).agreement()

                return agreements as []
            }
        })
    }, 
})
export const Payment = objectType({
    name:'Payment',
    definition(t) {
        t.nonNull.int('client');
        t.nonNull.int('payment');
        t.nonNull.date('date');
        t.nonNull.string('ref');
        t.nonNull.string('type');
        t.nonNull.string('description');
        t.string('bank')
        t.nonNull.amount('amount');
        t.nonNull.string('PaidBy', {
            async resolve(prt,__,cxt){
                const client = await  cxt.db.client.findFirst({where:{
                    client:prt.client
                }})
                //Return the name of the client.
                return client?.name as string
            }
        })
    },
})
export const Agreement = objectType({
    name:'Agreement',
    definition(t) {
        t.int('agreement');
        t.string('amount')
        t.string('start_date');
        // t.nonNull.list.nonNull.field('rooms', {
        //     type:'Room',
        //     async resolve(__, ___, cxt){
        //         return cxt.db.room.findUnique({
                
        //         }).agreement()
        //     }
        // })
    },
})

export const Room = objectType({
    name:'Room',
    definition(t) {
        t.id('room');
        t.string('title');
        t.string('uuid')
    },
})

// export const RentEntity = objectType({
//     name:'Rent',

// })