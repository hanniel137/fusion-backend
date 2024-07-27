import express, { json } from "express"
import cors from "cors"
import mysql from "mysql2/promise"
import 'dotenv/config'

const app = express()

app.use(express.json())
app.use(cors())

const db = await mysql.createConnection({
    host:process.env.DB_HOST,
    port:process.env.DB_PORT,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_DATABASE
})

app.get("/", (req,res)=>{
    res.json("Hello!")
})


app.get("/platform", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.processor where type='platform'"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/gpuType", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.processor where type='gputype'"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/series", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT series FROM fg_component_data.processor where type='processor' and platform='"+req.query.platform+"' and gpuType= '"+req.query.gpuType+"' group by series;"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/processor", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.processor where type='processor' and platform='"+req.query.platform+"' and series='"+req.query.generation+"' and gputype='"+req.query.gpuType+"'"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/ramType", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT chipsetRamType FROM fg_component_data.chipset where chipsetPlatform = (select socket from  fg_component_data.processor where title = '"+req.query.processor+ "') group by chipsetRamType;"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/ramSize", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.ram where ramType='"+req.query.ramType+"' and ramRGB='"+req.query.ramRGB+"'"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/chipset", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.chipset where chipsetPlatform = (select socket from fg_component_data.processor where title = '"+req.query.processor+"') and chipsetRamType = '"+req.query.ramType+"' and chipsetramSlots >= (select max(ramCount) from fg_component_data.ram where ramSize = '"+req.query.ramSize+"');"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/gpubrand", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT gpubrand FROM fg_component_data.gpu group by gpubrand;"
        );
        if(req.query.gpuType == 'In-Built'){
            res.json(results);
        } else {
            const arr = results.filter((result) => result.gpubrand != 'Stock');
            res.json(arr);
        }
        }
    catch (err) {
        console.log(err);
}})

app.get("/gpumodel", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.gpu where gpubrand='"+req.query.gpuBrand+"';"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/cooler", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT fg_component_data.cooler.*, fg_component_data.processor.cooler FROM fg_component_data.cooler, fg_component_data.processor where fg_component_data.processor.title = '"+req.query.processor+"';"
        );
        if(results[0].cooler == 'Box'){
            res.json(results);
        } else {
            const arr = results.filter((result) => result.coolername != 'Stock');
            res.json(arr);
        }
        }
    catch (err) {
        console.log(err);
}})

app.get("/storage", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.storage;"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/psu", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT * FROM fg_component_data.psu;"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/cabinetbrand", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT cabinetbrand FROM fg_component_data.cabinet group by cabinetbrand;"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/cabinetmodel", async (req,res)=>{
    try{
        const [results, fields] = await db.query(
            "SELECT cabinetmodel FROM fg_component_data.cabinet where cabinetbrand='"+req.query.cabinetBrand+"';"
        );
        res.json(results);
        }
    catch (err) {
        console.log(err);
}})

app.get("/price", async (req,res)=>{
    var pricePC = 0;
    try{
        const [processor, fields1] = await db.query(
            "select price from processor where title = '"+req.query.pc.processor+"';");
        const [gpu, fields2] = await db.query(
            "select price from gpu where gpumodel = '"+req.query.pc.gpuModel+"';");
        const [psu, fields3] = await db.query(
            "select price from psu where psuname = '"+req.query.pc.psu+"';");
        const [ram, fields4] = await db.query(
            "select ramPrice from ram where ramSize = '"+req.query.pc.ramSize+"' and ramRGB = '"+req.query.pc.ramRGB+"' and ramType = '"+req.query.pc.ramType+"';");
        const [cooler, fields5] = await db.query(
            "select price from cooler where coolername = '"+req.query.pc.cooler+"';");
        const [cabinet, fields7] = await db.query(
            "select price from cabinet where cabinetbrand = '"+req.query.pc.cabinetBrand+"' and cabinetmodel = '"+req.query.pc.cabinetModel+"';");
        const [primaryStorage, fields8] = await db.query(
            "select price from storage where storagename = '"+req.query.pc.primaryStorage+"';");
        const [secondaryStorage, fields9] = await db.query(
            "select price from storage where storagename = '"+req.query.pc.secondaryStorage+"';");
        const [chipset, fields10] = await db.query(
            "select chipsetPrice from chipset where chipsetName = '"+req.query.pc.chipset+"' and chipsetRamType = '"+req.query.pc.ramType+"';");
        pricePC = {price: Math.round(1.12 * (processor[0].price + gpu[0].price + psu[0].price + ram[0].ramPrice + cooler[0].price + chipset[0].chipsetPrice + primaryStorage[0].price + secondaryStorage[0].price + cabinet[0].price))};
        res.json(pricePC);
        }
    catch (err) {
        console.log(err);
        }
})

app.listen(8800, ()=>{
    console.log("Connected to backend!!")
})