import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()


const x = async () => await prisma.$executeRaw`Select * from client`
const y = async () => await prisma.$queryRaw`Select * from client`



 x().then((res) => {
    console.log(res); 
    if(typeof(res)){console.log('okay')}

})
//  y().then((res) =>  console.log(res))