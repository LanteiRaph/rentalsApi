import { Poster } from './lib/Poster'
import { Report } from './lib/report';
import { PrismaClient} from '@prisma/client';
import { Item_closing_balance, Item_Invoice, Item_openeing_balance, Item_water, payament } from './lib/items';
import { Item_Rent } from './lib/items/rent';
import { Item_Service } from './lib/items/services';
import { Item_credit, Item_debit } from './lib/items/adjustment';
import { Item_electricity } from './lib/items/electricity';
import { Options } from './lib/classes';
// const prisma = new PrismaClient();

const options: Options = {
    year: 2022 ,
    month: 7,
    monitor: true
}

// const poster = new Poster({});
//const report = new Report(options);

const init = async () => {
    //poster.parameter = 2
    // poster.monitor = true
    // // const unpost = await poster.post()
    //report.where = `client.name = 'chicjoint'`
    const poster =  Poster.init(options)

    const records = poster.report()
    
    //console.log(poster.monitor)
    //const d_sql = await report.get_driver_sql()
    // const cl = new Item_Service(poster)
    //  const record = await cl.detailed_poster()
    // console.log(record)
    // const sql = Prisma.sql([record])

    //  const records = await poster.dbase.$queryRaw(sql)
    return records
}

import express from "express";
import cors from 'cors';


const app = express();


const corsOption = {
    origin: ['http://localhost:3000'],
};
app.use(cors(corsOption));
//if you want in every domain then
app.use(cors())
app.get("/", async (req, res) => {
    //Ge all the values
    const readings = await init()
    //Exctract the maps objects from the readings.
    let result = [];
    //Step through the reading and creat a reasult out of them
    for (let i = 0; i < readings.length; i++) {
        const record = readings[i];
        result.push(Object.fromEntries(record))
    }
    //Return the result
    res.send(result);
});

app.post("/", async (req, res) => {

    res.send({ msg: '' });
});

// PORT
const PORT = 3002;

app.listen(PORT, () => {
    console.log(`Server is running on PORT: ${PORT}`);
});
