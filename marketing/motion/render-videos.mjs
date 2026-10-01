import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('C:/Users/NEUTRON/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const project=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'../..');
const out=path.join(project,'marketing');
const bird=await sharp(path.join(project,'public/assets/dovet-bird.png')).resize(360,360,{fit:'inside',kernel:'nearest'}).png().toBuffer();
const birdData=`data:image/png;base64,${bird.toString('base64')}`;
const W=1280,H=720,FPS=24,DURATION=8;
const C={cream:'#f6f1e5',paper:'#fffcf4',plum:'#24152d',red:'#cf493a',muted:'#968b95',line:'#d2c7c7',pale:'#e5dcd9'};
const clamp=x=>Math.max(0,Math.min(1,x));const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const rect=(x,y,w,h,fill,stroke='',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${sw}"`:''}/>`;
const text=(x,y,s,size=18,color=C.plum,weight=400,anchor='start')=>`<text x="${x}" y="${y}" font-family="Cascadia Mono,Consolas,monospace" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
const line=(x1,y1,x2,y2,c=C.plum,sw=2,dash='')=>`<path d="M${x1} ${y1}H${x2}V${y2}" fill="none" stroke="${c}" stroke-width="${sw}"${dash?` stroke-dasharray="${dash}"`:''}/>`;
const mark=(x,y,size=7,c=C.plum)=>`<g fill="${c}" transform="translate(${x} ${y})">${[[0,0],[2,0],[4,0],[0,1],[2,1],[4,1],[0,2],[2,2],[4,2]].map(([a,b])=>rect(a*size,b*size,size,size,c)).join('')}</g>`;
const dove=(x,y,size,rotation=0,opacity=1)=>`<g transform="translate(${Math.round(x)} ${Math.round(y)}) rotate(${rotation} ${size/2} ${size/2})" opacity="${opacity}"><image href="${birdData}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/></g>`;
function envelope(x,y,w,h,p=1){return`<g transform="translate(${x} ${y})" opacity="${p}">${rect(7,7,w,h,C.plum)}${rect(0,0,w,h,C.paper,C.plum,3)}<path d="M1 1L${w/2} ${h*.6}L${w-1} 1M1 ${h-1}L${w*.36} ${h*.44}M${w-1} ${h-1}L${w*.64} ${h*.44}" fill="none" stroke="${C.red}" stroke-width="3"/></g>`;}
function stamp(x,y,label,visible=1,angle=-7){return`<g opacity="${visible}" transform="translate(${x} ${y}) rotate(${angle})">${rect(0,0,162,48,'none',C.red,3)}${rect(5,5,152,38,'none',C.red,1)}${text(81,31,label,18,C.red,700,'middle')}</g>`;}
function shell(num,title,t,content,plum=false){
 const bg=plum?C.plum:C.cream,ink=plum?C.cream:C.plum;
 let pattern='';for(let x=24;x<W;x+=32)for(let y=24;y<H;y+=32)pattern+=rect(x,y,2,2,plum?'#46374d':'#e4dbd1');
 return`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rect(0,0,W,H,bg)}<g opacity=".55">${pattern}</g>${text(62,73,'DOVET',29,ink,700)}${mark(193,51,6,plum?C.red:C.plum)}${text(1218,68,`FIELD NOTE / 0${num}`,14,ink,500,'end')}${line(62,103,1218,103,plum?'#64566b':'#c9bbbc',1)}${content}${line(62,638,1218,638,plum?'#64566b':'#c9bbbc',1)}${text(62,677,'NO WALLET REQUIRED.',16,ink,500)}${text(1218,675,'ILLUSTRATIVE WORKFLOW',12,plum?'#baadbf':'#7f7181',400,'end')}</svg>`;
}
function first(t){
 const enter=smooth((t-.4)/1.1),scan=clamp((t-2)/2.2),birdX=58+Math.floor(smooth(t/1.8)*12)*8;
 let paper=`${rect(9,9,368,404,C.plum)}${rect(0,0,368,404,C.paper,C.plum,3)}${text(25,44,'MARKET RECORD',19,C.plum,700)}${text(25,68,'BEGIN WITH AN ADDRESS',11,C.muted)}${line(25,87,343,87,C.line,1)}`;
 [['MINT','The token address'],['MARKETS','Pair + venue context'],['SOURCES','URL + observation time']].forEach(([label,detail],i)=>{
  const active=scan>(i+1)*.23;
  paper+=rect(25,112+i*79,26,26,active?C.red:C.paper,C.plum,2)+text(65,131+i*79,label,16,C.plum,700)+text(65,157+i*79,detail,12,C.muted);
  if(active)paper+=`<path d="M31 ${126+i*79}l5 5l9 -12" fill="none" stroke="${C.paper}" stroke-width="2.5"/>`;
 });
 paper+=text(25,375,'READ THE RECORD. KEEP THE SOURCE.',12,C.plum);
 let content=`${text(62,190,'START WITH',54,C.plum,700)}${text(62,251,'THE MINT.',54,C.plum,700)}${text(65,310,'Read the market.',20)}${text(65,343,'Check the source.',20)}${dove(birdX,368+Math.floor(Math.sin(t*3)*2)*3,220,-2)}${envelope(370+Math.sin(t)*8,424,165,104)}<g transform="translate(${Math.round(746+(1-enter)*500)} 166)">${paper}</g>`;
 if(t>2&&t<4.4)content+=rect(744,269+scan*231,372,3,C.red);
 if(t>5)content+=stamp(919,550,'READ FIRST',smooth((t-5)/.4));
 return shell(1,'Verify a mint',t,content);
}
function second(t){
 const move=smooth((t-.4)/1.2),compare=clamp((t-2.4)/2.1);
 const receipt=(x,y,label,later)=>`<g transform="translate(${x} ${y})">${rect(8,8,338,273,C.plum)}${rect(0,0,338,273,C.paper,C.plum,3)}${rect(0,0,338,52,later?C.red:C.plum)}${text(20,34,label,20,C.paper,700)}${text(22,89,'SOURCE',11,C.muted)}${text(22,114,'Market observation',16)}${text(22,149,'CAPTURED AT',11,C.muted)}${text(22,175,later?'Later observation':'Earlier observation',16)}${line(22,195,316,195,C.line,1)}${text(22,232,'Evidence stays attached.',13)}</g>`;
 let content=`${text(62,174,'ONE SNAPSHOT IS',44,C.plum,700)}${text(62,223,'NOT THE STORY.',44,C.plum,700)}${text(62,267,'Compare observations. Keep the timestamps.',18)}${receipt(175-(1-move)*450,320,'OBSERVATION / A',false)}${receipt(753+(1-move)*450,320,'OBSERVATION / B',true)}${dove(51+Math.floor(t*4)%2*3,456,135)}${line(537,448,727,448,C.red,3,'7 7')}`;
 content+=`<path d="M707 435l20 13l-20 13" fill="none" stroke="${C.red}" stroke-width="3"/>`;
 for(let i=0;i<5;i++)content+=rect(588+i*15,418,7,7,compare>i/5?C.red:C.line);
 if(t>4.8)content+=stamp(588,541,'COMPARE',smooth((t-4.8)/.5),-5);
 return shell(2,'Compare observations',t,content);
}
function third(t){
 const enter=smooth((t-.3)/1.1),fold=smooth((t-3)/1.1),fly=smooth((t-5.1)/1.8),rY=176+fold*145;
 let content=`${text(62,187,'TAKE THE RECEIPT',43,C.cream,700)}${text(62,238,'WITH YOU.',43,C.cream,700)}${text(64,299,'Sourced. Timestamped. Exportable.',19,C.cream)}${text(64,340,'Keep the context outside the tab.',17,'#baadbf')}`;
 const sceneX=835+(1-enter)*500+fly*580;
 let receipt=`${rect(0,0,283,309,C.paper,C.cream,2)}${text(21,41,'DOVET / RECEIPT',20,C.plum,700)}${line(21,61,263,61,C.line,1)}${text(21,98,'MINT',13,C.muted)}${text(21,127,'Token identity',16)}${text(21,169,'OBSERVATIONS',13,C.muted)}${text(21,198,'Source + timestamp',16)}${text(21,241,'EXPORT',13,C.muted)}${text(21,271,'Portable evidence',16)}`;
 content+=`<defs><clipPath id="receipt-window">${rect(0,130,W,445,'white')}</clipPath></defs><g clip-path="url(#receipt-window)"><g transform="translate(${Math.round(sceneX)} ${rY})" opacity="${1-fly*.8}">${receipt}</g></g>`;
 content+=envelope(Math.round(sceneX-37),396,357,184);
 content+=dove(375+Math.floor(enter*5)*6+fly*560,390-fly*300+Math.floor(Math.sin(t*3))*3,205,fly*-8);
 if(t>4.3&&t<6.6)content+=stamp(884,488,'KEEP IT',smooth((t-4.3)/.4),-8);
 if(t>6.4)content+=`<g opacity="${smooth((t-6.4)/.5)}">${text(903,380,'READ.',38,C.cream,700,'middle')}${text(903,430,'COMPARE.',38,C.cream,700,'middle')}${text(903,480,'KEEP.',38,C.cream,700,'middle')}</g>`;
 return shell(3,'Export evidence',t,content,true);
}

const scenes=[first,second,third];
const selected=process.argv.includes('--posters')?'posters':'videos';
for(let i=0;i<scenes.length;i++){
 if(process.env.VIDEO&&Number(process.env.VIDEO)!==i+1)continue;
 const filename=`dovet-video-0${i+1}`;
 const poster=await sharp(Buffer.from(scenes[i](i===0?5.5:i===1?5.3:4.6))).png().toBuffer();
 fs.writeFileSync(path.join(out,`${filename}-poster.png`),poster);
 if(selected==='posters'){console.log(`${filename}: poster rendered`);continue;}
 const ffmpeg=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`${filename}.mp4`)],{windowsHide:true});
 let stderr='';ffmpeg.stderr.on('data',d=>stderr+=d);
 const ended=new Promise((resolve,reject)=>{ffmpeg.on('error',reject);ffmpeg.on('close',code=>code===0?resolve():reject(new Error(stderr||`ffmpeg exit ${code}`)));});
 for(let frame=0;frame<FPS*DURATION;frame++){
   const pixels=await sharp(Buffer.from(scenes[i](frame/FPS))).removeAlpha().raw().toBuffer();
   if(!ffmpeg.stdin.write(pixels))await new Promise(resolve=>ffmpeg.stdin.once('drain',resolve));
 }
 ffmpeg.stdin.end();await ended;console.log(`${filename}: ${DURATION}s ${W}x${H} ${FPS}fps MP4 rendered`);
}
