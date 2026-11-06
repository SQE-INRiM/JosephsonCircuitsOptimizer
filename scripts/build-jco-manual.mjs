// Generate the JCO user manual from docs/JCO_Documentation.md.
// Uses only Node.js built-ins. PDF uses standard fonts and has no external assets.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
function buildPdf(markdown) {
  const W=595,H=842,L=54,R=54,B=53,MAX=W-L-R;
  const ascii=s=>String(s).replace(/[^\x00-\x7F]/g,c=>({
    "—":"-","–":"-","−":"-","·":" | ","’":"'","‘":"'","“":'"',"”":'"',
    "→":"->","≤":"<=","≥":">=","…":"...","×":"x","µ":"u","Φ":"Phi",
    "₀":"0","₁":"1","²":"2","³":"3","≈":"~","Δ":"Delta","ω":"w","α":"alpha",
    "é":"e","è":"e","à":"a","ì":"i","ò":"o","ù":"u","í":"i"
  })[c]??"?");
  const esc=s=>ascii(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)").replace(/\r|\n/g," ");
  const plain=s=>ascii(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,"$1 ($2)")
      .replace(/`([^`]+)`/g,"$1")
      .replace(/\*\*([^*]+)\*\*/g,"$1")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,"$1")
      .replace(/ {2,}/g," ")
      .trim();
  const glyph=s=>{let w=0;for(const ch of s){const c=ch.charCodeAt(0);w+=(ch===" "?0.28:"ijlI.,'!;:|".includes(ch)?0.28:"WM@".includes(ch)?0.92:"mw%".includes(ch)?0.75:"ftk()[]{}-".includes(ch)?0.39:(c>=65&&c<=90)?0.67:0.54);}return w};
  const width=(s,size,font)=>font==="F3"?s.length*size*0.60:glyph(s)*size;
  function wrap(s,size,limit,font="F1"){
    let out=[],line="";
    for(const word of s.split(/\s+/)){
      if(!word)continue;
      if(width(word,size,font)>limit){
        if(line){out.push(line);line="";}
        let bit="";
        for(const c of word){if(width(bit+c,size,font)>limit&&bit){out.push(bit);bit="";}bit+=c;}
        line=bit;
      }else if(!line)line=word;
      else if(width(line+" "+word,size,font)<=limit)line+=" "+word;
      else{out.push(line);line=word;}
    }
    if(line)out.push(line);
    return out.length?out:[""];
  }
  const pages=[];
  let p;
  function newPage(){
    p={commands:[],y:pages.length===0?600:769};
    pages.push(p);
    if(pages.length===1){
      p.commands.push("0.063 0.161 0.265 rg 0 0 595 842 re f\n");
      p.commands.push("0.977 0.984 0.991 rg 0 0 595 674 re f\n");
      p.commands.push("0.125 0.741 0.678 rg 54 789 81 4 re f\n");
      p.commands.push("BT /F2 26 Tf 1 1 1 rg 54 745 Td (JCO User Manual) Tj ET\n");
      p.commands.push("BT /F1 12 Tf 0.79 0.87 0.92 rg 54 720 Td (JosephsonCircuitsOptimizer.jl) Tj ET\n");
      p.commands.push("BT /F1 9.4 Tf 0.72 0.81 0.87 rg 54 693 Td (Desktop GUI  |  Julia workflow  |  November 2026) Tj ET\n");
      p.commands.push("0.145 0.72 0.66 rg 54 645 487 1.5 re f\n");
      const boxes=[["MODEL",54,86],["LINEAR",153,84],["OPTIMIZE",250,105],["HB",369,56],["FEEDBACK",436,105]];
      for(const [label,x,w] of boxes){
        p.commands.push(`0.13 0.23 0.34 rg ${x} 618 ${w} 22 re f\n`);
        p.commands.push(`BT /F2 8.5 Tf 1 1 1 rg ${x+7} 625 Td (${esc(label)}) Tj ET\n`);
      }
    } else {
      p.commands.push("0.125 0.741 0.678 rg 54 797 36 2 re f\n");
      p.commands.push("BT /F2 8.3 Tf 0.17 0.24 0.32 rg 100 793 Td (JCO  /  USER MANUAL) Tj ET\n");
      p.commands.push("0.84 0.87 0.89 RG 0.6 w 54 787 m 541 787 l S\n");
    }
  }
  newPage();
  const fmt=(size,font,x,y,text,color="0.15 0.21 0.28")=>`BT /${font} ${size.toFixed(2)} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(text)}) Tj ET\n`;
  const ensure=h=>{if(p.y-h<B+6)newPage();};
  const para=(s,kind="p")=>{
    s=plain(s);if(!s)return;
    const note=/^(Important:|Linux support remains preliminary:)/.test(s);
    const font=kind==="li"?"F1":"F1";
    const size=9.85,lineh=14.1;
    const x=kind==="li"?L+16:L,avail=kind==="li"?MAX-16:MAX;
    const lines=wrap(s,size,avail-(note?16:0),font);
    ensure(lines.length*lineh+10);
    if(note){
      const hh=lines.length*lineh+11;
      p.commands.push(`0.988 0.961 0.894 rg ${L-5} ${(p.y-hh+13).toFixed(2)} ${MAX+10} ${hh.toFixed(2)} re f\n`);
      p.commands.push(`0.94 0.66 0.21 rg ${L-5} ${(p.y-hh+13).toFixed(2)} 3 ${hh.toFixed(2)} re f\n`);
    }
    if(kind==="li")p.commands.push(fmt(size,"F2",L,p.y,"-","0.10 0.52 0.54"));
    for(let i=0;i<lines.length;i++){
      p.commands.push(fmt(size,font,x+(note?4:0),p.y,lines[i]));
      p.y-=lineh;
    }
    p.y-=kind==="li"?3.6:7.7;
  };
  const header=(title,level)=>{
    const size=level===2?15.2:11.4;
    const gap=level===2?20:14;
    const lines=wrap(plain(title),size,MAX,"F2");
    ensure(gap+lines.length*(size+3)+31);
    p.y-=gap;
    if(level===2)p.commands.push(`0.125 0.741 0.678 rg ${L} ${(p.y+5).toFixed(2)} 27 2 re f\n`);
    for(let i=0;i<lines.length;i++){
      p.commands.push(fmt(size,"F2",L,p.y,lines[i],level===2?"0.07 0.16 0.28":"0.10 0.28 0.40"));
      p.y-=size+4;
    }
    p.y-=level===2?2:3;
  };
  const codeBlock=rows=>{
    const size=8.1,lh=10.9,maxWidth=MAX-26;
    const cooked=[];
    for(const r of rows){
      const parts=wrap(ascii(r).replace(/\t/g,"    "),size,maxWidth,"F3");
      cooked.push(...parts);
    }
    const blockH=cooked.length*lh+16;
    ensure(blockH+6);
    p.commands.push(`0.946 0.958 0.969 rg ${L} ${(p.y-blockH+4).toFixed(2)} ${MAX} ${blockH.toFixed(2)} re f\n`);
    p.commands.push(`0.75 0.83 0.87 rg ${L} ${(p.y-blockH+4).toFixed(2)} 2 ${blockH.toFixed(2)} re f\n`);
    p.y-=7;
    for(const text of cooked){p.commands.push(fmt(size,"F3",L+13,p.y,text,"0.14 0.23 0.32"));p.y-=lh;}
    p.y-=12;
  };
  const lines=markdown.replace(/\r\n/g,"\n").split("\n");
  let buf=[],code=[],inCode=false,skipCover=0;
  const flush=()=>{if(buf.length){para(buf.join(" ").trim());buf=[];}};
  const headings=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i],trim=line.trim();
    if(i===0&&trim.startsWith("# ")){skipCover=1;continue;}
    if(skipCover&&i<=3){if(trim==="")continue;if(trim.startsWith("*Josephson")||trim.startsWith("Updated ")){continue;}}
    if(trim.startsWith("```")){
      if(inCode){codeBlock(code);code=[];inCode=false;}else{flush();inCode=true;}
      continue;
    }
    if(inCode){code.push(line);continue;}
    const h2=/^##\s+(.+)$/.exec(trim);
    const h3=/^###\s+(.+)$/.exec(trim);
    const bullet=/^[-*]\s+(.+)$/.exec(trim);
    const ordered=/^\d+\.\s+(.+)$/.exec(trim);
    if(h2){flush();header(h2[1],2);headings.push({title:plain(h2[1]),page:pages.length-1,y:p.y+22});continue;}
    if(h3){flush();header(h3[1],3);continue;}
    if(bullet||ordered){flush();para((ordered?trim.match(/^\d+\./)[0]+" ":"")+(bullet?bullet[1]:ordered[1]),"li");continue;}
    if(trim.startsWith(">")){flush();para(trim.slice(1).trim());continue;}
    if(trim===""){flush();continue;}
    buf.push(trim);
  }
  flush();
  const pageCount=pages.length;
  for(let i=0;i<pageCount;i++){
    const q=pages[i];
    if(i===0){
      q.commands.push("0.19 0.26 0.34 rg 54 40 487 0.7 re f\n");
      q.commands.push(fmt(8.2,"F1",54,29,"JCO  /  documentation source: docs/JCO_Documentation.md","0.38 0.45 0.51"));
    }else{
      q.commands.push("0.83 0.86 0.89 RG 0.6 w 54 48 m 541 48 l S\n");
      q.commands.push(fmt(8.2,"F1",L,34,"JCO  |  November 2026","0.38 0.45 0.51"));
    }
    q.commands.push(fmt(8.2,"F1",501,34,`${i+1} / ${pageCount}`,"0.38 0.45 0.51"));
  }
  const n=pages.length,objects=[];
  const set=(id,contents)=>objects[id]=ascii(contents);
  const pageId=i=>6+i*2,streamId=i=>7+i*2;
  set(3,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  set(4,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  set(5,"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");
  for(let i=0;i<n;i++){
    const content=pages[i].commands.join("");
    set(streamId(i),`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    set(pageId(i),`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamId(i)} 0 R >>`);
  }
  const rootOutline=6+n*2,firstOutline=rootOutline+1;
  set(2,`<< /Type /Pages /Kids [${pages.map((_,i)=>pageId(i)+" 0 R").join(" ")}] /Count ${n} >>`);
  set(1,`<< /Type /Catalog /Pages 2 0 R /Outlines ${rootOutline} 0 R /PageMode /UseOutlines >>`);
  if(headings.length){
    set(rootOutline,`<< /Type /Outlines /First ${firstOutline} 0 R /Last ${firstOutline+headings.length-1} 0 R /Count ${headings.length} >>`);
    headings.forEach((head,i)=>{
      const oid=firstOutline+i,prev=i?`/Prev ${oid-1} 0 R`:"",next=i<headings.length-1?`/Next ${oid+1} 0 R`:"";
      set(oid,`<< /Title (${esc(head.title)}) /Parent ${rootOutline} 0 R ${prev} ${next} /Dest [${pageId(head.page)} 0 R /XYZ 54 ${Math.min(812,head.y+8).toFixed(2)} null] >>`);
    });
  } else set(rootOutline,"<< /Type /Outlines /Count 0 >>");
  const infoId=firstOutline+headings.length;
  set(infoId,"<< /Title (JCO User Manual) /Author (SQE-INRiM) /Subject (JosephsonCircuitsOptimizer GUI and Julia workflow) >>");
  let pdf="%PDF-1.4\n% ASCII-only PDF\n",offsets=[0];
  for(let i=1;i<=infoId;i++){
    offsets[i]=pdf.length;
    pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const startxref=pdf.length;
  pdf+=`xref\n0 ${infoId+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=infoId;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${infoId+1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  if(/[^\x00-\x7F]/.test(pdf))throw Error("Non-ASCII PDF");
  return {pdf,stats:{pages:n,sectionBookmarks:headings.length,bytes:pdf.length,sourceChars:markdown.length}};
}
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(dir, 'docs/JCO_Documentation.md'), 'utf8');
const output = buildPdf(src);
writeFileSync(resolve(dir, 'docs/JCO_Documentation.pdf'), Buffer.from(output.pdf, 'ascii'));
console.log(`Wrote ${output.stats.pages} pages, ${output.stats.bytes} bytes.`);
