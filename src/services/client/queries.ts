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

//
// export const Reports = extendType({
//     type: 'Query',
//     definition(t) {
//         t.nonNull.field('Client', {
//             type: 'Client',
//             args: {
//                 useremail: stringArg(),
//                 year: intArg(),
//                 month: intArg()
//             },
//             async resolve(parent, args, context) {
//                 //Get the client that matches the give user id
//                 const result = await context.prisma.client.findMany({ where: { email: args.useremail } })
//                 //Get the client.
//                 const client = result[0]
//             }
//         })
//     }
// })



// export const Allclients = extendType({
//     type:'Query',
//     definition(t){
//         t.nonNull.list.nonNull.field('AllClient', {
//             type: 'Client',
//             async resolve(prt, args , cxt) {
//                 const allClients = await cxt.prisma.client.findMany() 

//                 return allClients
//             }
//         })
//     }
// })