import PDFParser from 'pdf2json';
import { readFileSync } from 'fs';
function dump(path){
  return new Promise((res,rej)=>{
    const p=new PDFParser(null,1);
    p.on('pdfParser_dataError',e=>rej(e.parserError));
    p.on('pdfParser_dataReady',()=>res(p.getRawTextContent()));
    p.parseBuffer(readFileSync(path));
  });
}
const file=process.argv[2];
const txt=await dump(file);
console.log(`=== ${file} (${txt.length} chars) ===`);
console.log(txt.slice(0, 3500));
