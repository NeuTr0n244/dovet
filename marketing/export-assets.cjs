const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('C:/Users/NEUTRON/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const directory=__dirname;
const assets=[
  {
    "key": "bird",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-a9c61b96-c7ca-4ce3-85c9-4a0e367d86fe.png",
    "raw": "dovet-bird-original.png",
    "out": "dovet-logo-transparent.png",
    "width": 1254,
    "height": 1254
  },
  {
    "key": "avatar",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-38263e89-e5b0-4841-809e-488118739127.png",
    "raw": "dovet-avatar-original.png",
    "out": "dovet-avatar.png",
    "width": 1024,
    "height": 1024
  },
  {
    "key": "banner",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-8c279d58-617d-46a1-b6f0-8044c6f82387.png",
    "raw": "dovet-banner-original.png",
    "out": "dovet-x-banner.png",
    "width": 1500,
    "height": 500
  },
  {
    "key": "post-01",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-d14c413a-6b2f-4f93-8198-bda548b7f3cd.png",
    "raw": "dovet-post-01-original.png",
    "out": "dovet-post-01.png",
    "width": 1600,
    "height": 900
  },
  {
    "key": "post-02",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-c28a63ab-a323-4ec0-bbc6-e0849fe0d6a1.png",
    "raw": "dovet-post-02-original.png",
    "out": "dovet-post-02.png",
    "width": 1600,
    "height": 900
  },
  {
    "key": "post-03",
    "source": "C:/Users/NEUTRON/.codex/generated_images/01a0f582-9482-7fc2-a226-7d65247f39f4/exec-e189b579-c169-4df4-96cd-c8bcb709be5a.png",
    "raw": "dovet-post-03-original.png",
    "out": "dovet-post-03.png",
    "width": 1600,
    "height": 900
  }
];
(async()=>{
 await fs.mkdir(path.join(directory,'raw'),{recursive:true});
 const results=[];
 for(const asset of assets){
  const raw=path.join(directory,'raw',asset.raw);
  const output=path.join(directory,asset.out);
  try { await fs.access(raw); } catch { await fs.copyFile(asset.source,raw); }
  if(asset.key==='bird') await fs.copyFile(raw,output);
  else await sharp(raw).resize(asset.width,asset.height,{fit:'fill',kernel:sharp.kernel.nearest}).png().toFile(output);
  const metadata=await sharp(output).metadata();
  results.push({file:asset.out,width:metadata.width,height:metadata.height,hasAlpha:metadata.hasAlpha,bytes:(await fs.stat(output)).size});
 }
 await fs.copyFile(path.join(directory,'dovet-avatar.png'),path.join(directory,'dovet-logo.png'));
 const logoMetadata=await sharp(path.join(directory,'dovet-logo.png')).metadata();
 results.push({file:'dovet-logo.png',width:logoMetadata.width,height:logoMetadata.height,hasAlpha:logoMetadata.hasAlpha,bytes:(await fs.stat(path.join(directory,'dovet-logo.png'))).size});
 await fs.writeFile(path.join(directory,'asset-manifest.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exit(1);});
