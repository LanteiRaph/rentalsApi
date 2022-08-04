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
    floatArg,
} from "nexus";

//Define al the mutations to be berfomed on the database.
export const Mutations = extendType({
    type: 'Mutation',
    definition(t) {
        t.nonNull.field('createPayment', {
            type: 'Payment',
            args: {
                amount: floatArg(),
                description: stringArg(),
                clientEmail: stringArg(),
                ref:stringArg()
            },
            async resolve(prt, args, cxt) {
                //Creete a new payment
                const newPayment = await
                    cxt.db.payment.create({
                        data: {
                            date: new Date(),
                            amount: args.amount,
                            description: args.description,
                            ref:args.ref,
                            client_clientTopayment:{
                                connect:{
                                    email:args.clientEmail
                                }
                            }
                        }
                    });
                //return the newly created payment
                return newPayment
            }
        });
        // t.nonNull.field('createCommunication', {
        //     type: 'Communication',
        //     args: {
        //         clientEmail: stringArg(),
        //         msg: stringArg()
        //     },
        //     async resolve(prt, args, cxt) {
        //         //Create the new communication with the client
        //         const newCommunication = await
        //             cxt.db.communications.create({
        //                 data: {
        //                     ref: args.msg,
        //                     client: {connect:{email:args.clientEmail}}
        //                 }
        //             })
        //         //return the new payment
        //         return newCommunication
        //     }
        // })
    }
})