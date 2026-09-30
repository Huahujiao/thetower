const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4177);
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.webp':'image/webp',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg'
};

const server = http.createServer((req,res)=>{
  let urlPath=decodeURIComponent(req.url.split('?')[0]);
  if(urlPath==='/')urlPath='/index.html';
  const filePath=path.normalize(path.join(ROOT,urlPath));
  if(!filePath.startsWith(ROOT)){res.writeHead(403);res.end('Forbidden');return}
  fs.stat(filePath,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not Found');return}
    const ext=path.extname(filePath).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(filePath).pipe(res);
  });
});
server.listen(PORT,'127.0.0.1',()=>{
  console.log(`Sprite Island Slicer: http://127.0.0.1:${PORT}`);
  console.log('请使用 Chrome / Edge 打开以上地址。');
});
