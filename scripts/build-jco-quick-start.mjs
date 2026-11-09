// JCO Quick Start PDF, using the embedded Latin Modern fonts and original design
// of the 19-page JCO User Manual. No extra packages beyond Node.js are needed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
function makeQuickStart(sourcePdf,markdown){
 const A4={w:595.276,h:841.89};
 const endTag="\nstartxref\n216\n%%EOF\n";
 const originalEnd=sourcePdf.indexOf(endTag);
 if(originalEnd<0)throw Error("Original PDF revision not present: do not reuse changed font resource IDs.");
 const base=sourcePdf.slice(0,originalEnd+endTag.length);
 if(base.length<700000||base.length>1000000||!base.startsWith("%PDF-1.5")||!base.includes("292 0 obj"))throw Error("Original manual PDF not recognized.");
 const accent="0.12549 0.47842 0.36472",navy="0.08 0.15 0.25",ink="0.13 0.20 0.29",steel="0.51471 0.61824 0.71098",pale="0.95686 0.96863 0.98040";
 const margins={left:70,right:68,bottom:74,top:746},width=A4.w-margins.left-margins.right;
 const pageId=i=>800+i*2,contentsId=i=>801+i*2;
 const sub={"—":"-","–":"-","−":"-","→":"->","←":"<-","≤":"<=","≥":">=","“":'"',"”":'"',"‘":"'","’":"'","…":"...","×":"x","µ":"u","Φ":"Phi","₀":"0","₁":"1","²":"2","³":"3","é":"e","è":"e","ò":"o","à":"a","ì":"i","ù":"u","α":"alpha","β":"beta","ω":"omega","Δ":"Delta","σ":"sigma","π":"pi","θ":"theta","λ":"lambda","κ":"kappa","φ":"phi","°":"deg"," ":" "};
 const normalize=s=>String(s).replace(/[^\x20-\x7E\n]/g,c=>sub[c]??"?");
 const escape=s=>normalize(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/[\r\n]/g," ");
 function stripMd(s){
   return normalize(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_m,t,url)=>`${t} (${url})`)
    .replace(/!\[([^\]]+)\]\([^)]+\)/g,"$1")
    .replace(/\*\*([^*]+)\*\*/g,"$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,"$1")
    .replace(/`([^`]+)`/g,"$1")
    .replace(/\\\((.+?)\\\)/g,"$1")
    .replace(/[ \t]+/g," ")
    .trim();
 }
 function widthApprox(s,size,code=false){
   if(code)return s.length*size*.60;
   let x=0;
   for(const c of s){
    let v=c===" "?.285:"iIjl.,'!;:|".includes(c)?.26:"MW@".includes(c)?.91:"mw%".includes(c)?.76:"ft()[]{}-".includes(c)?.40:/[A-Z]/.test(c)?.70:.56;
    x+=v;
   }
   return x*size;
 }
 function linesOf(s,size,maxW,code=false){
   const words=stripMd(s).split(/\s+/),out=[];let line="";
   for(const word of words){
     if(!word)continue;
     if(widthApprox(word,size,code)>maxW){
       if(line){out.push(line);line="";}
       let fragment="";
       for(const c of word){if(widthApprox(fragment+c,size,code)>maxW&&fragment){out.push(fragment);fragment="";}fragment+=c;}
       line=fragment;
     }else if(!line)line=word;
     else if(widthApprox(`${line} ${word}`,size,code)<=maxW)line+=` ${word}`;
     else {out.push(line);line=word;}
   }
   if(line)out.push(line);
   return out.length?out:[""];
 }
 const command=(font,size,x,y,string,color=ink)=>`BT /${font} ${size.toFixed(3)} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escape(string)}) Tj ET\n`;
 const pages=[],headings=[];
 function makeCover(){
   const out=[];
   const text=(font,size,x,y,string,color="0 0 0")=>out.push(command(font,size,x,y,string,color));
   text("F49",24.787,113.894,667.239,"JosephsonCircuitsOptimizer.jl");
   text("F52",17.215,248.2,635.4,"Quick Start");
   text("F55",11.55,132.5,593.1,"Desktop setup, simulation and nonlinear analysis");
   out.push(`q\n${steel} rg\n108.197 460.461 378.886 87.802 re f\n${pale} rg\n109.615 461.879 376.05 84.965 re f\nQ\n`);
   text("F58",10.909,150.5,528.0,"Repository:");
   text("F61",10.5,229.0,528.0,"SQE-INRiM/JosephsonCircuitsOptimizer");
   text("F58",10.909,150.5,508.7,"Project format:");
   text("F61",10.5,229.0,508.7,".jco");
   text("F58",10.909,150.5,489.4,"Target release:");
   text("F61",10.5,229.0,489.4,"v0.5.0 (in preparation)");
   text("F58",10.909,150.5,470.1,"Document date:");
   text("F61",10.5,229.0,470.1,"November 2026");
   const coverWords=[
     "This short guide introduces the JCO desktop application and the most common simulation workflow.",
     "For detailed syntax, solver options, data storage and nonlinear feedback, see the complete JCO User Manual.",
     "The instructions describe the upcoming v0.5.0 GUI; published releases may contain earlier features."
   ];
   let y=275.5;
   for(const paragraph of coverWords){
    for(const l of linesOf(paragraph,10.35,378.886)){
      text("F43",10.35,108.197,y,l);
      y-=15.4;
    }
    y-=8.7;
   }
   pages.push({cover:true,ops:out,y:0,words:[]});
 }
 function newPage(){
   const current={cover:false,ops:[],y:margins.top,words:[]};pages.push(current);
   current.ops.push(`${accent} rg 70 798 38 2.4 re f\n`);
   current.ops.push(command("F58",9.2,123,792.9,"JCO  /  QUICK START","0.16 0.24 0.33"));
   current.ops.push(`0.75 0.80 0.84 RG 0.6 w 70 781.6 m 527.2 781.6 l S\n`);
   return current;
 }
 let curr;
 function ensure(needed){
   if(!curr||curr.y-needed<margins.bottom)curr=newPage();
 }
 function textLine(s,style={}){
  const {font="F43",size=10.7,x=margins.left,color=ink,leading=15.35,kind="body"}=style;
  ensure(leading+1);
  curr.ops.push(command(font,size,x,curr.y,s,color));
  curr.words.push({s,x,y:curr.y,size,font,kind});
  curr.y-=leading;
 }
 function para(s,{indent=0,bullet=null,note=false}={}){
  const size=10.7,lead=15.45,startX=margins.left+indent,avail=width-indent-1;
  const text=stripMd(s);
  if(!text)return;
  const ll=linesOf(text,size,avail-(note?18:0));
  ensure(ll.length*lead+14);
  if(note){
    const hh=ll.length*lead+13;
    curr.ops.push(`${pale} rg ${margins.left-4} ${(curr.y-hh+12).toFixed(2)} ${(width+8).toFixed(2)} ${(hh).toFixed(2)} re f\n`);
    curr.ops.push(`${accent} rg ${margins.left-4} ${(curr.y-hh+12).toFixed(2)} 2.3 ${(hh).toFixed(2)} re f\n`);
  }
  if(bullet!==null)curr.ops.push(command("F58",10.7,margins.left+4,curr.y,bullet,accent));
  for(const line of ll)textLine(line,{size,x:startX+(note?6:0),leading:lead,kind:"body"});
  curr.y-=bullet!==null?4:9;
 }
 function heading(text,level=2){
  const title=stripMd(text),size=level===2?16.0:12.2,font=level===2?"F52":"F58";
  const ll=linesOf(title,size,width-12);
  const topGap=level===2?20:12,lead=size+4.8;
  ensure(topGap+ll.length*lead+19);
  curr.y-=topGap;
  headings.push({text:title,page:pages.length-1,y:curr.y});
  for(const l of ll)textLine(l,{font,size,x:margins.left+(level===2?5:0),color:navy,leading:lead,kind:"heading"});
  curr.y-=level===2?10:7;
 }
 function code(lines){
  const size=8.55,lead=12.65,max=width-27;
  const prepared=[];
  for(const src of lines){
    const raw=normalize(src.replace(/\t/g,"    "));
    if(widthApprox(raw,size,true)<=max){prepared.push(raw);continue;}
    const n=Math.floor(max/(size*.60));
    for(let j=0;j<raw.length;j+=n)prepared.push(raw.slice(j,j+n));
  }
  const h=prepared.length*lead+20;
  if(h>margins.top-margins.bottom)throw Error("Code example too tall for a page");
  ensure(h+13);
  curr.ops.push(`${pale} rg ${margins.left} ${(curr.y-h+7).toFixed(2)} ${width.toFixed(2)} ${h.toFixed(2)} re f\n`);
  curr.ops.push(`${steel} rg ${margins.left} ${(curr.y-h+7).toFixed(2)} 2.2 ${h.toFixed(2)} re f\n`);
  curr.y-=9;
  for(const t of prepared)textLine(t,{font:"FM",size,x:margins.left+13,color:"0.17 0.24 0.30",leading:lead,kind:"code"});
  curr.y-=15;
 }
 makeCover();
 curr=newPage();
 const inLines=markdown.replace(/\r\n/g,"\n").split("\n");
 let buffer=[],codeLines=[],inCode=false,omitHeader=true;
 const flush=()=>{if(buffer.length){para(buffer.join(" "));buffer=[];}};
 for(const original of inLines){
  const t=original.trim();
  if(t.startsWith("# ")&&omitHeader){omitHeader=false;continue;}
  if(t.startsWith("*JosephsonCircuitsOptimizer.jl")||t.startsWith("Prepared for v0.5.0"))continue;
  if(t.startsWith("```")){if(inCode){code(codeLines);codeLines=[];inCode=false;}else{flush();inCode=true;}continue;}
  if(inCode){codeLines.push(original);continue;}
  if(/^## /.test(t)){flush();heading(t.slice(3),2);continue;}
  if(/^### /.test(t)){flush();heading(t.slice(4),3);continue;}
  if(/^\s*[-*]\s+/.test(original)){flush();para(t.replace(/^[-*]\s+/,""),{indent:17,bullet:"-"});continue;}
  const ordered=t.match(/^(\d+)\.\s+(.+)$/);
  if(ordered){flush();para(ordered[2],{indent:19,bullet:ordered[1]+"."});continue;}
  if(t.startsWith("|")){
    if(t.match(/^\|[\s\-:|]+\|?$/))continue;
    flush();
    const cells=t.replace(/^\||\|$/g,"").split("|").map(x=>x.trim());
    if(cells[0]==="GUI setting")continue;
    para(`${cells[0]}: ${cells.slice(1).join(" / ")}`,{indent:17,bullet:"-"});
    continue;
  }
  if(!t){flush();continue;}
  if(t.startsWith(">")){flush();para(t.slice(1),{note:true});continue;}
  buffer.push(t);
 }
 flush();
 const total=pages.length;
 for(let ix=1;ix<total;ix++){
   const p=pages[ix];
   p.ops.push("0.78 0.82 0.86 RG 0.55 w 70 56 m 527.2 56 l S\n");
   p.ops.push(command("F43",8.7,70,40.2,"JosephsonCircuitsOptimizer.jl  |  v0.5.0 preview","0.37 0.43 0.49"));
   p.ops.push(command("F43",8.7,481,40.2,`${ix} / ${total-1}`,"0.37 0.43 0.49"));
 }
 const overflow=pages.flatMap((p,j)=>p.words.filter(t=>t.y<70||t.y>758||t.x+widthApprox(t.s,t.size,t.kind==="code")>532).map(t=>({page:j+1,...t})));
 if(overflow.length)throw Error(`Layout overflows: ${JSON.stringify(overflow.slice(0,7))}`);
 const obj=new Map(),PAGE_ROOT=452,OUTLINE_ROOT=836,INFO=837,MONO=838;
 obj.set(292,`<< /Type /Catalog /Pages ${PAGE_ROOT} 0 R /Outlines ${OUTLINE_ROOT} 0 R /PageMode /UseOutlines >>`);
 obj.set(PAGE_ROOT,`<< /Type /Pages /Count ${total} /Kids [ ${pages.map((_p,i)=>pageId(i)+" 0 R").join(" ")} ] >>`);
 obj.set(MONO,"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
 obj.set(INFO,`<< /Title (JCO Quick Start - v0.5.0 Preview) /Author (SQE-INRiM) /Creator (JCO Quick Start generator) /Subject (Desktop setup and workflow) >>`);
 for(let ix=0;ix<pages.length;ix++){
   const content=pages[ix].ops.join("");
   if(/[^\x00-\x7F]/.test(content))throw Error("Non-ASCII PDF page stream");
   obj.set(pageId(ix),`<< /Type /Page /Parent ${PAGE_ROOT} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F43 393 0 R /F49 388 0 R /F52 389 0 R /F55 390 0 R /F58 391 0 R /F61 392 0 R /FM ${MONO} 0 R >> >> /Contents ${contentsId(ix)} 0 R >>`);
   obj.set(contentsId(ix),`<< /Length ${content.length} >>\nstream\n${content}endstream`);
 }
 const bookmarks=headings.filter(h=>h.page>0&&h.page<total);
 obj.set(OUTLINE_ROOT,`<< /Type /Outlines /First 850 0 R /Last ${849+bookmarks.length} 0 R /Count ${bookmarks.length} >>`);
 for(let i=0;i<bookmarks.length;i++){
    const bm=bookmarks[i],id=850+i;
    const prev=i?`/Prev ${id-1} 0 R`:"",next=i+1<bookmarks.length?`/Next ${id+1} 0 R`:"";
    obj.set(id,`<< /Title (${escape(bm.text)}) /Parent ${OUTLINE_ROOT} 0 R ${prev} ${next} /Dest [${pageId(bm.page)} 0 R /XYZ 70 ${Math.min(770,bm.y+32).toFixed(2)} null] >>`);
 }
 let pdf=base,offsets=[];
 for(const [id,data] of [...obj.entries()].sort((a,b)=>a[0]-b[0])){
   const pos=pdf.length+1;
   pdf+=`\n${id} 0 obj\n${data}\nendobj\n`;
   offsets.push({id,pos});
 }
 const xrefPos=pdf.length;
 pdf+="xref\n";
 let series=[];
 const flushSeries=()=>{
   if(!series.length)return;
   pdf+=`${series[0].id} ${series.length}\n`;
   for(const x of series)pdf+=`${String(x.pos).padStart(10,"0")} 00000 n \n`;
 };
 for(const item of offsets){
   if(series.length&&item.id!==series.at(-1).id+1){flushSeries();series=[];}
   series.push(item);
 }
 flushSeries();
 const sz=Math.max(...offsets.map(x=>x.id))+1;
 pdf+=`trailer\n<< /Size ${sz} /Root 292 0 R /Info ${INFO} 0 R /Prev 216 >>\nstartxref\n${xrefPos}\n%%EOF\n`;
 if(!pdf.slice(xrefPos).startsWith("xref\n"))throw Error("Invalid xref position");
 for(const x of offsets)if(!pdf.slice(x.pos).startsWith(`${x.id} 0 obj\n`))throw Error("Incorrect byte offset "+x.id);
 const sections=[...new Set(bookmarks.filter(x=>/^\d+\./.test(x.text)).map(x=>x.text))];
 return {pdf,stats:{pages:total,bodyPages:total-1,bookmarks:bookmarks.length,sections,baseBytes:base.length,generatedBytes:pdf.length-base.length,totalBytes:pdf.length,lines:pages.reduce((a,p)=>a+p.words.length,0),coverFont:"original Latin Modern Type1 fonts",bodyBounds:[margins.left,margins.right,margins.bottom,margins.top]}};
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const basePdf = readFileSync(resolve(root,'docs/JCO_Documentation.pdf')).toString('latin1');
const markdown = readFileSync(resolve(root,'docs/JCO_Quick_Start.md'),'utf8');
const out = makeQuickStart(basePdf,markdown);
writeFileSync(resolve(root,'docs/JCO_Quick_Start.pdf'),Buffer.from(out.pdf,'latin1'));
console.log(`Updated JCO Quick Start: ${out.stats.pages} pages.`);
