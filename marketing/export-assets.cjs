const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require(process.env.SHARP_MODULE || 'sharp');
const directory=__dirname;
const verifyOnly=process.argv.includes('--verify-only');
const assets=[
 {key:'bird',raw:'dovet-bird-original.png',out:'dovet-logo-transparent.png',width:1254,height:1254},
 {key:'avatar',raw:'dovet-avatar-original.png',out:'dovet-avatar.png',width:1024,height:1024},
 {key:'banner',raw:'dovet-banner-original.png',out:'dovet-x-banner.png',width:1500,height:500},
 {key:'post-01',raw:'dovet-post-01-original.png',out:'dovet-post-01.png',width:1600,height:900},
 {key:'post-02',raw:'dovet-post-02-original.png',out:'dovet-post-02.png',width:1600,height:900},
 {key:'post-03',raw:'dovet-post-03-original.png',out:'dovet-post-03.png',width:1600,height:900}
];
(async()=>{
 for(const asset of assets) await fs.access(path.join(directory,'raw',asset.raw));
 const results=[];
 for(const asset of assets){
  const raw=path.join(directory,'raw',asset.raw);
  const output=path.join(directory,asset.out);
  if(!verifyOnly){
   if(asset.key==='bird') await fs.copyFile(raw,output);
   else await sharp(raw).resize(asset.width,asset.height,{fit:'fill',kernel:sharp.kernel.nearest}).png().toFile(output);
  }
  const metadata=await sharp(output).metadata();
  if(metadata.width!==asset.width||metadata.height!==asset.height) throw new Error('Unexpected export dimensions: '+asset.out);
  results.push({file:asset.out,originalPath:'raw/'+asset.raw,width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha,bytes:(await fs.stat(output)).size});
 }
 if(!verifyOnly) await fs.copyFile(path.join(directory,'dovet-avatar.png'),path.join(directory,'dovet-logo.png'));
 const logoPath=path.join(directory,'dovet-logo.png');
 const logoMetadata=await sharp(logoPath).metadata();
 results.push({file:'dovet-logo.png',originalPath:'raw/dovet-avatar-original.png',width:logoMetadata.width,height:logoMetadata.height,hasAlpha:logoMetadata.hasAlpha,bytes:(await fs.stat(logoPath)).size});
 await fs.writeFile(path.join(directory,'asset-manifest.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exit(1);});
