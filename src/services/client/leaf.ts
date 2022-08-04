// import {
//     nonNull,
//     objectType,
//     inputObjectType,
//     enumType,
//     arg,
//     list,
// } from "nexus";


// export const Period = objectType({
//     name: 'Period',
//     definition(t) {
//         t.nonNull.id('period')
//         t.nonNull.int('month');
//         t.nonNull.int('year');
//         t.nonNull.string('cutoff');
//     }
// })



// export const Invoice = objectType({
//     name: 'Invoice',
//     definition(t) {
//         t.nonNull.int('client')
//         t.nonNull.int('invoice');
//         t.nonNull.int('period');
//         t.nonNull.field('forMonth', {
//             type: 'Period',
//             async resolve(prt, args, cxt) {
//                 const result = await cxt.prisma.period.findMany({ where: { period: prt.period } })

//                 return result[0]
//             }
//         });
//         t.nonNull.list.nonNull.field('Water', {
//             type: 'Water',
//             resolve(prt, args, cxt) {
//                 return cxt.prisma.water.findMany({ where: { invoice: prt.invoice } })
//             }
//         });
//         t.nonNull.list.nonNull.field('Power', {
//             type: 'Power',
//             async resolve(prt, args, cxt) {
//                 return cxt.prisma.electricity.findMany({ where: { invoice: prt.invoice, client:prt.client} })
//             }
//         });
//         t.nonNull.field('closing_balance', {
//             type:'Closing_balance',
//             async resolve(prt, args, cxt){
//                 const result =  await cxt.prisma.closing_balance.findMany({where:{invoice:prt.invoice}})
//                 return result[0]   
//             }
//         })
//     }
// })



// export const Client = objectType({
//     name: 'Client',
//     definition(t) {
//         t.nonNull.id('client');
//         t.nonNull.string('name');
//         t.nonNull.string('email');
//         t.nonNull.list.nonNull.field('Invoices', {
//             type: 'Invoice',
//             async resolve(parent, args, context) {
//                 return await context.prisma.invoice.findMany({ where: { client: parent.client }, take: 4, orderBy: { period: 'desc' } })
//             }
//         });
//         //a client might have more than one agreement.
//         t.nonNull.list.nonNull.field('agreement', {
//             type:'Agreement',
//             async resolve(prt, args, cxt){
//                 return await cxt.prisma.agreement.findMany({where:{client:prt.client}})
                
//             }
//         })
//     }
// })

// //Payment type:Represnet the payment table
// export const Payment = objectType({
//     name:'Payment',
//     definition(t){
//         t.nonNull.id('payment')
//         t.nonNull.float('amount');
//         t.nonNull.string('date');
//         t.nonNull.string('description');
//     }
// })
// //The communication type: communication represnt any chat bewteen the tenat and the landlord.
// export const Communication = objectType({
//     name:'Communication',
//     definition(t){
//         t.nonNull.id('communication');
//         t.nonNull.string('ref')
//     }
// })
// export const Agreement = objectType({
//     name:'Agreement',
//     definition(t){
//         t.nonNull.id('agreement')
//         t.float('amount');
//         t.nonNull.string('start_date');
//         t.nonNull.int('duration');
//         t.nonNull.int('review');
//         t.nonNull.string('terminated');
//         t.nonNull.boolean('valid');
//         t.nonNull.string('comment');
//     }
// })

// export const Room = objectType({
//     name:'Room',
//     definition(t){
//         t.nonNull.id('room')
//         t.nonNull.string('title');
//         t.nonNull.string('floor');
//         t.nonNull.string('wing');
//         t.nonNull.list.nonNull.field('pictures', {
//             type:'Picture',
//             async resolve(prt, args, cxt){
//                 return await cxt.prisma.picture.findMany({where:{room:prt.room}})
//             }
//         });
//         t.nonNull.field('property',{
//             type:'Property',
//             async resolve(prt, args, cxt){
//                 const result = await cxt.prisma.property.findMany({where:{room:prt.room}})
//                 return result[0]
//             }
//         })
//     } 
// })

// export const Property = objectType({
//     name:'Property',
//     definition(t){
//         t.nonNull.id('property')
//         t.nonNull.string('name');
//         t.nonNull.string('location');
//     }
// })

// export const Picture = objectType({
//     name:'Picture',
//     definition(t){
//         t.nonNull.id('picture');
//         t.nonNull.string('name');
//         t.nonNull.string('elevation')
//     }
// })


// export const Water = objectType({
//     name: 'Water',
//     definition(t) {
//         t.nonNull.id('water')
//         t.nonNull.float('amount');
//         t.nonNull.string('curr_date')
//     }
// })

// export const Power = objectType({
//     name: 'Power',
//     definition(t) {
//         t.nonNull.id('electricity')
//         t.nonNull.string('eaccount_no');
//         t.string('payable_to_kplc')
//     }
// })

// export const ClosingBalance = objectType({
//     name:'Closing_balance',
//     definition(t){
//         t.nonNull.id('closing_balance')
//         t.nonNull.float('amount');
//     }
// })
