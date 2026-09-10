const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname, page = path.join(root, 'nur-aiym-qr-menu.html'), store = path.join(root, 'nur-aiym-data.json');
const sessions = new Map(), listeners = new Set(), printJobs = [];
const initial = { foods: [
  {id:1,name:'Палау',category:'Ыстық тағамдар',price:1800,emoji:'🍛',desc:'Хош иісті күріш, ет және сәбіз'},
  {id:2,name:'Қуырдақ',category:'Ыстық тағамдар',price:2200,emoji:'🥘',desc:'Үйдің дәстүрлі қуырдағы'},
  {id:3,name:'Цезарь салаты',category:'Салаттар',price:1600,emoji:'🥗',desc:'Тауық еті мен жаңа көкөністер'},
  {id:4,name:'Лағман',category:'Ыстық тағамдар',price:1900,emoji:'🍜',desc:'Қол кеспе, ет және көкөністер'},
  {id:5,name:'Баурсақ',category:'Нан өнімдері',price:600,emoji:'🥯',desc:'Жаңа піскен бауырсақ'},
  {id:6,name:'Шай',category:'Сусындар',price:400,emoji:'🍵',desc:'Қара немесе көк шай'}
], tables:[1,2,3,4,5,6,7,8], orders:[], categories:['Ыстық тағамдар','Салаттар','Нан өнімдері','Сусындар'] };
function data(){try{return JSON.parse(fs.readFileSync(store,'utf8'))}catch{return structuredClone(initial)}}
function save(value){fs.writeFileSync(store,JSON.stringify(value,null,2),'utf8')}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
function read(req){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>3000000)req.destroy()});req.on('end',()=>{try{resolve(body?JSON.parse(body):{})}catch{reject()}})})}
function user(req){const value=req.headers.authorization||'';return value.startsWith('Bearer ')?sessions.get(value.slice(7)):null}
function allow(req,res,roles){const account=user(req);if(!account||account.until<Date.now()||!roles.includes(account.role)){json(res,401,{ok:false,error:'Кіру қажет'});return null}return account}
function event(name,payload){const message=`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;for(const res of listeners)res.write(message)}
function publicData(db){return {foods:db.foods,categories:db.categories,tables:db.tables,logo:db.logo||''}}
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/public'&&req.method==='GET')return json(res,200,publicData(data()));
  if(url.pathname==='/api/login'&&req.method==='POST'){try{const body=await read(req);const kitchen=body.login==='кухния'&&body.password===(process.env.KITCHEN_PASSWORD||'02');const admin=body.login===(process.env.ADMIN_LOGIN||'1111')&&body.password===(process.env.ADMIN_PASSWORD||'3333');if(!kitchen&&!admin)return json(res,401,{ok:false,error:'Логин немесе құпиясөз қате.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{role:kitchen?'kitchen':'admin',until:Date.now()+28800000});return json(res,200,{ok:true,token,role:kitchen?'kitchen':'admin'})}catch{return json(res,400,{ok:false})}}
  if(url.pathname==='/api/events'&&req.method==='GET'){const eventUser=sessions.get(url.searchParams.get('token'))||user(req);if(!eventUser||eventUser.until<Date.now()||!['admin','kitchen'].includes(eventUser.role))return json(res,401,{ok:false});res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive'});res.write('event: connected\ndata: {}\n\n');listeners.add(res);req.on('close',()=>listeners.delete(res));return}
  if(url.pathname==='/api/orders'&&req.method==='POST'){try{const body=await read(req),db=data();const items=(Array.isArray(body.items)?body.items:[]).map(line=>{const food=db.foods.find(f=>f.id===Number(line.id)&&!f.stopped),qty=Math.max(1,Math.min(50,Number(line.qty)||1));return food&&{id:food.id,name:food.name,price:food.price,qty}}).filter(Boolean);if(!items.length)return json(res,400,{ok:false,error:'Себет бос.'});const type=['table','pickup','delivery'].includes(body.type)?body.type:'pickup';const order={id:Date.now(),number:db.orders.length+1,type,table:type==='table'?String(body.table||''):'',customer:String(body.customer||'').slice(0,80),phone:String(body.phone||'').slice(0,30),address:type==='delivery'?String(body.address||'').slice(0,180):'',items,total:items.reduce((s,i)=>s+i.price*i.qty,0),status:'Жаңа',date:new Date().toLocaleString('kk-KZ')};db.orders.unshift(order);save(db);printJobs.unshift({id:crypto.randomUUID(),createdAt:Date.now(),order});event('new-order',order);return json(res,201,{ok:true,order})}catch{return json(res,400,{ok:false,error:'Тапсырыс сақталмады.'})}}
  if(url.pathname==='/api/orders'&&req.method==='GET'){if(!allow(req,res,['admin','kitchen']))return;return json(res,200,{orders:data().orders})}
  if(url.pathname.startsWith('/api/orders/')&&req.method==='PATCH'){if(!allow(req,res,['admin','kitchen']))return;try{const body=await read(req),db=data(),order=db.orders.find(o=>String(o.id)===url.pathname.split('/').pop());if(!order)return json(res,404,{ok:false});order.status=['Жаңа','Дайындалуда','Дайын','Жабылды'].includes(body.status)?body.status:order.status;save(db);event('order-updated',order);return json(res,200,{ok:true})}catch{return json(res,400,{ok:false})}}
  if(url.pathname==='/api/data'&&req.method==='GET'){if(!allow(req,res,['admin']))return;return json(res,200,data())}
  if(url.pathname==='/api/data'&&req.method==='POST'){if(!allow(req,res,['admin']))return;try{const next=await read(req);if(!Array.isArray(next.foods)||!Array.isArray(next.orders))throw Error();save(next);event('menu-updated',publicData(next));return json(res,200,{ok:true})}catch{return json(res,400,{ok:false})}}
  if(url.pathname==='/api/print-jobs'&&req.method==='GET'){if(!process.env.PRINTER_KEY||req.headers['x-printer-key']!==process.env.PRINTER_KEY)return json(res,401,{ok:false});return json(res,200,{jobs:printJobs.splice(0)})}
  if(['/','/admin','/kitchen','/nur-aiym-qr-menu.html'].includes(url.pathname)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(page,'utf8'))}
  res.writeHead(404);res.end('Not found');
}).listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('NUR-AIYM QR menu started'));
