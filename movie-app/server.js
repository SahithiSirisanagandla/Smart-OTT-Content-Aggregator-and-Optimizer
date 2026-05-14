require('dns').setDefaultResultOrder('ipv4first');
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET || "secret123",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false
    }
}));

mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.error("MongoDB Error:",err));

const User = mongoose.model("User", new mongoose.Schema({
    email:{type:String,required:true,unique:true},
    username:{type:String,required:true},
    password:{type:String,required:true},
    region:{type:String, default:"India"},
    language:{type:String, default:"English"}
}));

// await User.save();
const Watchlist = mongoose.model("Watchlist", new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    tmdbId:{
        type:String,
        required:true
    },
    title:String,
    poster:String,
    year:String,
    streaming:[
        {
            name:String,
            link:String
        }
    ],
    addedAt:{
        type:Date,
        default:Date.now
    }
}));

Watchlist.collection.createIndex(
{userId:1,tmdbId:1},
{unique:true}
);

function requireLogin(req,res,next){
    if(!req.session.userId){
        return res.status(401).json({error:"Not logged in"});
    }
    next();
}

app.post("/api/signup",async(req,res)=>{
try{
const {email,username,password}=req.body;
if(!email||!username||!password){
return res.status(400).json({error:"All fields required"});
}
const existing=await User.findOne({email});
if(existing){
return res.status(400).json({error:"Email already registered"});
}
const hashed=await bcrypt.hash(password,10);
const user=new User({
email,
username,
password:hashed
});
await user.save();
res.json({message:"Signup successful"});
}catch(err){
res.status(500).json({error:"Signup failed"});
}
});

app.post("/api/login",async(req,res)=>{
try{
const {email,password}=req.body;
const user=await User.findOne({email});
if(!user){
return res.status(401).json({error:"Invalid credentials"});
}
const match=await bcrypt.compare(password,user.password);
if(!match){
return res.status(401).json({error:"Invalid credentials"});
}
req.session.userId=user._id;
req.session.username=user.username;
res.json({
message:"Login successful",
username:user.username
});
}catch{
res.status(500).json({error:"Login failed"});
}
});

app.post("/api/logout",(req,res)=>{
req.session.destroy(()=>{
res.json({message:"Logged out"});
});
});

app.post("/api/watchlist/add",requireLogin,async(req,res)=>{

try{

const movie=req.body;

if(!movie.movieId){
return res.status(400).json({error:"Movie ID required"});
}

const existing=await Watchlist.findOne({
userId:req.session.userId,
tmdbId:movie.movieId
});

if(existing){
return res.json({error:"Movie already in watchlist"});
}

await Watchlist.create({

userId:req.session.userId,
tmdbId:movie.movieId,
title:movie.title,
poster:movie.poster,
year:movie.year,
streaming:movie.streaming || []

});

res.json({
success:true,
message:"Added to Watchlist"
});

}catch(err){

console.log(err);
res.status(500).json({error:"Could not save to watchlist"});

}

});

app.get("/api/watchlist",requireLogin,async(req,res)=>{

try{

const list=await Watchlist.find({
userId:req.session.userId
}).sort({addedAt:-1});

res.json(list);

}catch{

res.status(500).json({error:"Failed to fetch watchlist"});

}

});

app.delete("/api/watchlist/remove/:id", requireLogin, async (req, res) => {
    try {

        console.log("Received ID:", req.params.id);

        const result = await Watchlist.deleteOne({
            _id: req.params.id,
            userId: req.session.userId
        });

        res.json({ success: true, result });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to remove movie" });
    }
});


app.get("/search",async(req,res)=>{
const movieName=req.query.q;
if(!movieName){
return res.json([]);
}
try{
const tmdbUrl=`https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_KEY}&query=${encodeURIComponent(movieName)}`;

const tmdbRes=await fetch(tmdbUrl);
const tmdbData=await tmdbRes.json();

if(!tmdbData.results){
return res.json([]);
}
// const limitedResults = tmdbData.results.slice(0, 5);
const results=await Promise.all(
tmdbData.results.map(async(movie)=>{
try{
const wmUrl=`https://api.watchmode.com/v1/title/movie-${movie.id}/sources/?apiKey=${process.env.WATCHMODE_KEY}`;
const wmRes=await fetch(wmUrl);
const wmData=await wmRes.json();
const providers=Array.isArray(wmData)
? wmData
// .filter(s=>s.type==="sub"||s.type==="free")
.filter(s => ['sub','free','rent','buy'].includes(s.type))
.filter((v,i,a)=>a.findIndex(t=>t.name===v.name)===i)
: [];
return{
movieId:movie.id,
title:movie.title,

year:movie.release_date
? movie.release_date.split("-")[0]
: "N/A",
poster:movie.poster_path
? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
: null,
overview:movie.overview||"No description",
streaming:providers.map(p=>({
name:p.name,
link:p.web_url
}))
};
}catch{
return null;
}
})
);

res.json(results.filter(r=>r!==null));

}catch(err){

console.error("Search error:",err);
res.status(500).json({error:"Search failed"});
}
});


// app.get("/search",async(req,res)=>{
// const movieName=req.query.q;
// if(!movieName){
// return res.json([]);
// }
// try{
// const tmdbUrl=`https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_KEY}&query=${encodeURIComponent(movieName)}`;

// const tmdbRes=await fetch(tmdbUrl);
// const tmdbData=await tmdbRes.json();

// if(!tmdbData.results){
// return res.json([]);
// }
// const results=await Promise.all(
// tmdbData.results.map(async(movie)=>{
// try{
// const wmUrl=`https://api.watchmode.com/v1/title/movie-${movie.id}/sources/?apiKey=${process.env.WATCHMODE_KEY}`;
// const wmRes=await fetch(wmUrl);
// const wmData=await wmRes.json();
// const providers=Array.isArray(wmData)
// ? wmData
// .filter(s=>s.type==="sub"||s.type==="free")
// // .filter(s => ["sub","free","rent","buy"].includes(s.type))
// .filter((v,i,a)=>a.findIndex(t=>t.name===v.name)===i)
// : [];
// return{
// movieId:movie.id,
// title:movie.title,

// year:movie.release_date
// ? movie.release_date.split("-")[0]
// : "N/A",
// poster:movie.poster_path
// ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
// : null,
// overview:movie.overview||"No description",
// streaming:providers
// .filter(p => p.web_url)
// .map(p=>({
// name:p.name,
// link:p.web_url
// }))
// };
// }catch{
// return null;
// }
// })
// );

// res.json(results.filter(r=>r!==null));

// }catch(err){
// console.error("Search error:",err);
// res.status(500).json({error:"Search failed"});
// }
// });

app.post("/api/change-password", requireLogin, async (req,res)=>{
try{
const {currentPassword,newPassword}=req.body;
const user=await User.findById(req.session.userId);
if(!user) return res.json({error:"User not found"});
const isMatch = await bcrypt.compare(currentPassword, user.password);
if(!isMatch){
   return res.send("Current password incorrect");
}
user.password=newPassword;
await user.save();
res.json({success:true});
}catch(err){
res.status(500).json({error:"Server error"});
}
});

app.post("/api/change-password", async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!req.session.userId) {
            return res.status(401).json({ error: "Not logged in" });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Current password is incorrect" });
        }

        // ✅ HASH the new password (IMPORTANT)
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        await user.save();

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Password update failed" });
    }
});

app.delete("/api/delete-account", requireLogin, async (req,res)=>{

try{

await User.deleteOne({_id:req.session.userId});

req.session.destroy();

res.json({success:true});

}catch(err){

res.status(500).json({error:"Failed to delete account"});

}

});

app.post("/update-region", requireLogin, async (req, res) => {

  try {

    const { region } = req.body;

    await User.updateOne(
      { _id: req.session.userId },
      { $set: { region: region } }
    );

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update region" });
  }

});


app.post("/update-language", requireLogin, async (req, res) => {

  try {

    const { language } = req.body;

    await User.updateOne(
      { _id: req.session.userId },
      { $set: { language: language } }
    );

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update language" });
  }

});


app.get("/user-settings", requireLogin, async (req, res) => {
try{
const user = await User.findById(req.session.userId);
res.json({
username: user.username,
region: user.region,
language: user.language
});
}catch(err){
res.status(500).json({ error:"Failed to fetch user data" });
}
});


app.listen(PORT,()=>{
console.log(`Server running at http://localhost:${PORT}`);
});