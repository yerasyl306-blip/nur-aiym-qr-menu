const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const html = path.join(root, 'nur-aiym-qr-menu.html');
const store = path.join(root, 'nur-aiym-data.json');
const initial = {foods:[{id:1,name:'Палау',category:'Ыстық тағамдар',price:1800,emoji:'🍛',desc:'Хош иісті күріш, ет және сәбіз'},{id:2,name:'Қуырдақ',category:'Ыстық тағамдар',price:2200,emoji:'🥘',desc:'Үйдің дәстүрлі қуырдағы'},{id:3,name:'Цезарь салаты',category:'Салаттар',price:1600,emoji:'🥗',desc:'Тауық еті мен жаңа көкөністер'},{id:4,name:'Лағман',category:'Ыстық тағамдар',price:1900,emoji:'🍜',desc:'Қол кеспе, ет және көкөністер'},{id:5,name:'Баурсақ',category:'Нан өнімдері',price:600,emoji:'🥯',desc:'Жаңа піскен бауырсақ'},{id:6,name:'Шай',category:'Сусындар',price:400,emoji:'🍵',desc:'Қара немесе көк шай'}],tables:[1,2,3,4,5,6,7,8],orders:[],categories:['Ыстық тағамдар','Салаттар','Нан өнімдері','Сусындар']};
function data(){try{return JSON.parse(fs.readFileSync(store,'utf8'))}catch{return initial}}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/data'&&req.method==='GET')return json(res,200,data());
  if(url.pathname==='/api/data'&&req.method==='POST'){let body='';req.on('data',x=>body+=x);req.on('end',()=>{try{let next=JSON.parse(body);if(!Array.isArray(next.foods)||!Array.isArray(next.orders))throw Error();fs.writeFileSync(store,JSON.stringify(next,null,2));json(res,200,{ok:true})}catch{json(res,400,{ok:false})}});return}
  if(url.pathname==='/'||url.pathname==='/nur-aiym-qr-menu.html'){const page=fs.readFileSync(html,'utf8').replace('<head>','<head><script>window.__SERVER_DB__='+JSON.stringify(data()).replace(/</g,'\\u003c')+';</script>');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(page);return}
  res.writeHead(404);res.end('Not found');
}).listen(3000,'0.0.0.0',()=>console.log('НҰР-АЙЫМ QR мәзірі: http://localhost:3000'));
