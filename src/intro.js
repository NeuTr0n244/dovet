const SESSION_KEY = 'dovet.intro.seen.v1';

/** Decorative introduction only. It never represents collection or verification work. */
export function mountIntro({ onComplete = () => {}, replay = false } = {}) {
  let seen = false;
  try { seen = sessionStorage.getItem(SESSION_KEY) === 'yes'; } catch { /* Storage is optional. */ }
  if ((!replay && seen) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    queueMicrotask(onComplete);
    return () => {};
  }
  const previousFocus = document.activeElement;
  const previousOverflow = document.body.style.overflow;
  const host = document.createElement('div');
  host.className = 'dovet-native-intro';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'DOVET animated introduction');
  host.innerHTML = `<style>
  .dovet-native-intro{position:fixed;inset:0;z-index:9999;background:#f6f1e5;color:#24152d;display:grid;place-items:center;overflow:hidden;font-family:'IBM Plex Mono',monospace;--open:0;--leave:0;opacity:calc(1 - var(--leave));}
  .dovet-native-intro *{box-sizing:border-box}.dovet-intro-top{position:absolute;left:clamp(22px,5vw,80px);right:clamp(22px,5vw,80px);top:30px;display:flex;justify-content:space-between;gap:20px;align-items:center;font-size:11px;letter-spacing:.12em}.dovet-intro-brand{font-family:Silkscreen,monospace;font-size:23px;letter-spacing:-.07em}.dovet-intro-skip{position:absolute;bottom:26px;right:clamp(22px,5vw,80px);border:0;border-bottom:1px solid #24152d;background:none;color:#24152d;font:12px 'IBM Plex Mono',monospace;padding:8px 0;cursor:pointer}.dovet-intro-skip:focus-visible{outline:2px solid #cf493a;outline-offset:6px}.dovet-intro-window{position:relative;width:min(860px,88vw);height:min(380px,47vh);border:3px solid #24152d;background:#ece5d5;box-shadow:9px 9px 0 #24152d;overflow:hidden;isolation:isolate}.dovet-intro-window:before{content:'';position:absolute;inset:0;background-image:linear-gradient(#24152d0a 1px,transparent 1px),linear-gradient(90deg,#24152d0a 1px,transparent 1px);background-size:24px 24px}.dovet-intro-shutter{position:absolute;z-index:5;inset:0;background:repeating-linear-gradient(0deg,#24152d 0 20px,#38233f 20px 23px);transform:translateY(calc(var(--open)*-102%));border-bottom:5px solid #cf493a}.dovet-intro-route{position:absolute;left:12%;right:12%;top:61%;height:2px;background:repeating-linear-gradient(90deg,#24152d 0 9px,transparent 9px 18px)}.dovet-intro-stops{position:absolute;left:9%;right:9%;top:63%;display:flex;justify-content:space-between;align-items:flex-start}.dovet-intro-stop{font-size:11px;letter-spacing:.1em;text-align:center}.dovet-intro-stamp{width:44px;height:44px;border:2px solid #24152d;background:#f6f1e5;display:grid;place-items:center;margin:0 auto 11px;box-shadow:3px 3px 0 #24152d;transform:translateY(-24px)}.dovet-intro-stop.active .dovet-intro-stamp{background:#cf493a;color:#f6f1e5;border-color:#cf493a;transform:translateY(-24px) rotate(-7deg)}.dovet-intro-bird{position:absolute;left:0;top:0;width:clamp(90px,15vw,160px);height:clamp(90px,15vw,160px);object-fit:contain;image-rendering:pixelated;z-index:3;will-change:transform}.dovet-intro-carried{position:absolute;width:30px;height:20px;background:#f6f1e5;border:2px solid #24152d;z-index:4;transform-origin:center;will-change:transform}.dovet-intro-carried:before{content:'';position:absolute;width:18px;height:18px;border-right:2px solid #cf493a;border-bottom:2px solid #cf493a;left:4px;top:-11px;transform:rotate(45deg)}.dovet-intro-receipt{position:absolute;left:50%;top:33%;width:220px;padding:19px 20px;background:#f6f1e5;border:2px solid #24152d;box-shadow:5px 5px 0 #24152d;z-index:4;opacity:0;transform:translate(-50%,-25px) rotate(-3deg);font-size:10px;line-height:1.8}.dovet-intro-receipt strong{font-size:24px;font-family:Silkscreen,monospace;font-weight:400;display:block;margin-bottom:10px}.dovet-intro-receipt em{display:block;font-style:normal;border-top:1px dashed #24152d;padding-top:8px;color:#cf493a}.dovet-intro-foot{position:absolute;left:clamp(22px,5vw,80px);bottom:35px;font-size:11px;letter-spacing:.06em}.dovet-intro-window-label{position:absolute;left:18px;top:15px;font-size:10px;letter-spacing:.12em}.dovet-intro-caption{position:absolute;top:calc(50% + min(190px,23.5vh) + 25px);font-size:12px;letter-spacing:.07em;text-align:center}
  @media(max-width:600px){.dovet-intro-top{top:24px}.dovet-intro-top>span:last-child{font-size:9px}.dovet-intro-window{height:310px}.dovet-intro-caption{top:calc(50% + 181px);font-size:10px}.dovet-intro-foot{bottom:39px;font-size:9px}.dovet-intro-stops{left:5%;right:5%}.dovet-intro-stop{font-size:9px}.dovet-intro-bird{width:110px;height:110px}}
  </style>
  <div class="dovet-intro-top"><span class="dovet-intro-brand">DOVET</span><span>A SHORT INTRODUCTION / 01</span></div>
  <div class="dovet-intro-window" aria-hidden="true"><div class="dovet-intro-window-label">THE EVIDENCE POST</div><div class="dovet-intro-route"></div><div class="dovet-intro-stops"><div class="dovet-intro-stop"><span class="dovet-intro-stamp">01</span>READ</div><div class="dovet-intro-stop"><span class="dovet-intro-stamp">02</span>COMPARE</div><div class="dovet-intro-stop"><span class="dovet-intro-stamp">03</span>KEEP</div></div><img class="dovet-intro-bird" src="/assets/dovet-bird.png" alt=""><div class="dovet-intro-carried"></div><div class="dovet-intro-receipt"><strong>DOVET</strong>READ. COMPARE. KEEP.<em>YOUR EVIDENCE, DELIVERED.</em></div><div class="dovet-intro-shutter"></div></div>
  <div class="dovet-intro-caption">A little post for the bigger picture.</div><span class="dovet-intro-foot">NO WALLET REQUIRED.</span><button class="dovet-intro-skip" type="button">Skip intro ↗</button>`;
  document.body.append(host);document.body.style.overflow='hidden';
  const windowEl=host.querySelector('.dovet-intro-window'),bird=host.querySelector('.dovet-intro-bird'),letter=host.querySelector('.dovet-intro-carried'),receipt=host.querySelector('.dovet-intro-receipt'),skip=host.querySelector('.dovet-intro-skip'),stops=[...host.querySelectorAll('.dovet-intro-stop')];
  let finished=false,started=false,raf=0,start=0,lastFrame=-1;
  const clamp=n=>Math.min(1,Math.max(0,n));
  const clean=()=>{cancelAnimationFrame(raf);clearTimeout(assetTimeout);bird.removeEventListener('load',begin);bird.removeEventListener('error',finish);document.removeEventListener('keydown',key);host.remove();document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus?.();};
  function finish(){if(finished)return;finished=true;try{sessionStorage.setItem(SESSION_KEY,'yes');}catch{}clean();onComplete();}
  function key(event){if(event.key==='Escape'){event.preventDefault();finish();}else if(event.key==='Tab'){event.preventDefault();skip.focus();}}
  function frame(now){
    if(finished)return;
    const age=(now-start)/1000,index=Math.floor(age*18);
    if(index!==lastFrame){lastFrame=index;const t=index/18,travel=clamp((t-.37)/1.93),w=windowEl.clientWidth,h=windowEl.clientHeight,size=bird.clientWidth,x=-size*.65+travel*(w+size*.7),y=h*.38-size*.55-Math.sin(travel*Math.PI*2)*h*.12;
      host.style.setProperty('--open',String(clamp(t/.46)));host.style.setProperty('--leave',String(clamp((t-2.95)/.3)));
      bird.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px) rotate(${Math.round(Math.cos(travel*Math.PI*2)*-5)}deg)`;
      bird.style.opacity=travel>.97?'0':'1';letter.style.opacity=t>2.29?'0':'1';letter.style.transform=`translate(${Math.round(x+size*.72)}px,${Math.round(y+size*.65)}px) rotate(-7deg)`;
      stops.forEach((stop,i)=>stop.classList.toggle('active',travel>(i+1)*.25));
      const landed=clamp((t-2.26)/.36);receipt.style.opacity=String(landed);receipt.style.transform=`translate(-50%,${-25+landed*25}px) rotate(${-3+landed*3}deg)`;
    }
    if(age>=3.28){finish();return;}raf=requestAnimationFrame(frame);
  }
  function begin(){if(started||finished)return;started=true;clearTimeout(assetTimeout);start=performance.now();raf=requestAnimationFrame(frame);}
  skip.addEventListener('click',finish);document.addEventListener('keydown',key);skip.focus({preventScroll:true});
  const assetTimeout=setTimeout(finish,2500);
  bird.addEventListener('load',begin);bird.addEventListener('error',finish);if(bird.complete&&bird.naturalWidth>0)begin();
  return()=>{if(finished)return;finished=true;clean();};
}
