import express, { json } from "express"
import cors from "cors"
import mysql from "mysql2/promise"
import 'dotenv/config'
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import cookieParser from "cookie-parser"

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(cors({credentials: true, origin: 'https://fusion-client.vercel.app'}))

const db = await mysql.createConnection({
    host:process.env.DB_HOST,
    port:process.env.DB_PORT,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_DATABASE_COMPS
})

const user = await mysql.createConnection({
    host:process.env.DB_HOST,
    port:process.env.DB_PORT,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_DATABASE_USER
})

const secretKey1 = process.env.ACCESS_TOKEN_SECRET;
const secretKey2 = process.env.REFRESH_TOKEN_SECRET;

const authenticate = (req, res, next) => {
    const accessToken = req.headers['Authorization'];
    const refreshToken = req.cookies['refreshToken'];
  
    if (!accessToken && !refreshToken) {
      return res.status(401).send('Access Denied. No token provided.');
    }
  
    try {
      const decoded = jwt.verify(accessToken, secretKey1);
      req.user = decoded.user;
      next();
    } catch (error) {
      if (!refreshToken) {
        return res.status(401).send('Access Denied. No refresh token provided.');
      }
  
      try {
        const decoded = jwt.verify(refreshToken, secretKey2);
        const accessToken = jwt.sign({ user: decoded.user }, secretKey1, { expiresIn: '20s' });
  
        res
          .cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
          .header('Authorization', accessToken)
          .send(decoded.user);
      } catch (error) {
        return res.status(400).send('Invalid Token.');
      }
    }
  };

app.post("/register", async(req,res)=>{
    try {
        const {firstName, lastName, number, email, password, retypePassword} = req.body;
        if (!(firstName && lastName && number && email && password && retypePassword)){
            res.status(401).send('All fields are mandatory!!');
            return;
        }
        if (password !== retypePassword){
            res.status(402).send('Password Mismatch!!');
            return;
        }
        const [count, fields] = await user.query(
            "SELECT COUNT(*) AS CNT FROM fg_user_data.user where number = "+number+" or email='"+email+"'"
        );
        if(count[0].CNT){
            res.status(403).send('User Already Exists!!');
            return;
        } else {
            var salt = bcrypt.genSaltSync(10);
            var hashedPassword = bcrypt.hashSync(password, salt);
            const [count, fields] = await user.query(
                "INSERT INTO fg_user_data.user (firstname, lastname, number, email, password) VALUES ('"+req.body.firstName+"', '"+req.body.lastName+"', "+req.body.number+", '"+req.body.email+"', '"+hashedPassword+"')"
            )
            res.status(201).send("Sucess!! User Created!");
        }

    } catch (err) {
        console.log(err);
    }
})

app.post("/login", async(req,res)=>{
    try{
        const {number, password} = req.body;
        if (!(number && password)){
            res.status(401).send("All fields are mandatory!");
            return;
        }
        const [count, fields1] = await user.query(
            "SELECT COUNT(*) AS CNT FROM fg_user_data.user where number='"+number+"'"
        )
        if(!(count[0].CNT)){
            res.status(402).send('User does not exist!');
            return;
        } else {
            const [userChk, fields2] = await user.query(
                "SELECT password, firstname, number, email FROM fg_user_data.user where number='"+number+"'"
            )
            const passCheck = await bcrypt.compare(password, userChk[0].password);
            if(passCheck){
                const userInfo = {"firstName": userChk[0].firstname,
                    "number" : userChk[0].number,
                    "email" : userChk[0].email
                }
                const accessToken = jwt.sign({userInfo},
                    secretKey1,
                    { expiresIn: '60s'}
                );
                const refreshToken = jwt.sign({userInfo},
                    secretKey2,
                    { expiresIn: '3600s'}
                );
                res.cookie('refreshToken', refreshToken, { expires: new Date(new Date().getTime()+60*60*1000), httpOnly: true, secure: false}).header('Authorization', accessToken).send(userInfo);
            } else {
                res.status(403).send("Invalid Password!");
                return;
            }
        }
    }
    catch(err){
        console.log(err); 
    }
})

app.post('/refresh', (req, res) => {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
      return res.status(401).send('Access Denied. No refresh token provided.');
    }
  
    try {
      const decoded = jwt.verify(refreshToken, secretKey2);
      const accessToken = jwt.sign({ user: decoded.user }, secretKey1, { expiresIn: '60s' });
  
      res
        .header('Authorization', accessToken)
        .send(decoded.userInfo);
    } catch (error) {
      return res.status(400).send('Invalid refresh token.');
    }
  });

app.get("/logout", async(req, res)=> {
    try {
        res.clearCookie('jwt', { httpOnly: true, secure: false, path: '/' });
        res.status(200).send("Logged Out!")
    } catch (err) {
        console.log(err);
    }
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
