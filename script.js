// PDF Worker Setting
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const ui = {
    initTheme: () => {
        const saved = localStorage.getItem('v11_theme');
        if (saved === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('meta-theme').setAttribute('content', '#0d1117');
        } else if (saved === 'light') {
            document.body.classList.remove('dark-mode');
            document.getElementById('meta-theme').setAttribute('content', '#ffffff');
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
                document.getElementById('meta-theme').setAttribute('content', '#0d1117');
            }
        }
    },
    toggleTheme: () => {
        const isDark = document.body.classList.toggle('dark-mode');
        const theme = isDark ? 'dark' : 'light';
        localStorage.setItem('v11_theme', theme);
        document.getElementById('meta-theme').setAttribute('content', isDark ? '#0d1117' : '#ffffff');
    },

    nav: (p) => {
        document.querySelectorAll('.page').forEach(e=>e.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));
        document.getElementById(p==='chat'?'p-chat':'p-cal').classList.add('active');
        document.querySelectorAll('.nav-item')[p==='chat'?0:1].classList.add('active');
    },
    modal: (s) => { document.getElementById('set-modal').style.display = s?'flex':'none'; if(s) core.renderMemCards(); },
    tab: (t) => {
        document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
        document.getElementById('tab-'+t).classList.add('active');
        const map = {'conn':0, 'voice':1, 'mem':2, 'bkp':3};
        document.querySelectorAll('.tab')[map[t]].classList.add('active');
    },
    toggleSidebar: (open) => {
        const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay');
        if(open) { sb.classList.add('open'); ov.style.display='block'; core.renderSessionList(); }
        else { sb.classList.remove('open'); ov.style.display='none'; }
    },
    bubble: (role, txt, img=null, file=null) => {
        const d = document.createElement('div'); d.className = `bubble ${role==='user'?'u-msg':'a-msg'}`;
        let content = "";
        if(img) content += `<img src="${img}">`;
        if(file) content += `<div class="file-tag">📄 ${file}</div>`;
        content += role==='user' ? txt : marked.parse(txt);
        
        const now = new Date();
        const tStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        content += `<div class="time">${tStr}</div>`;
        
        if(role !== 'user') {
             const rawTxt = txt.replace(/"/g, '&quot;');
             content += `<div class="replay-btn" onclick="core.speak('${rawTxt}', true)">🔈 Replay</div>`;
             d.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY); };
             let timer;
             d.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY), 600); };
             d.ontouchend = () => clearTimeout(timer);
             d.ontouchmove = () => clearTimeout(timer);
        }
        d.innerHTML = content;
        const box = document.getElementById('chat-box'); box.appendChild(d); box.scrollTop=box.scrollHeight;
        return d;
    },
    showCtx: (x, y) => {
        const m = document.getElementById('ctx-menu');
        m.style.display = 'block';
        m.style.left = Math.min(x, window.innerWidth - 150) + 'px';
        m.style.top = y + 'px';
    },
    hideCtx: () => document.getElementById('ctx-menu').style.display = 'none',
    
    addPreview: (type, src, name) => {
        const p = document.getElementById('preview-area');
        p.style.display = 'flex';
        const d = document.createElement('div'); d.className='preview-item';
        if(type==='img') d.innerHTML = `<img src="${src}" class="preview-img"><span class="close-prev" onclick="core.clearPreview('img')">×</span>`;
        else d.innerHTML = `📄 ${name} <span class="close-prev" onclick="core.clearPreview('file')">×</span>`;
        p.appendChild(d);
    },
    clearPreviews: () => { document.getElementById('preview-area').innerHTML=''; document.getElementById('preview-area').style.display='none'; }
};

const core = {
    conf: { url:'', key:'', model:'', persona:'' },
    voiceConf: { mode: 'native', key: '', voice: 'onyx' },
    mems: [], evts: [], sessions: {}, currSessId: null,
    autoTTS: false, 
    currUpload: { img: null, fileText: null, fileName: null },

    init: () => {
        ui.initTheme();
        ['url','key','model','persona'].forEach(k => core.conf[k] = localStorage.getItem('v11_'+k) || '');
        if(!core.conf.url) core.preset('ds');
        if(!core.conf.persona) core.conf.persona = "你叫艾德里安·席勒，教授。";
        document.getElementById('c-url').value = core.conf.url;
        document.getElementById('c-key').value = core.conf.key;
        document.getElementById('c-mod').value = core.conf.model;
        document.getElementById('c-per').value = core.conf.persona;

        const v = localStorage.getItem('v11_voice'); if(v) core.voiceConf = JSON.parse(v); core.updateVoiceUI();
        
        try { core.mems = JSON.parse(localStorage.getItem('v11_mems') || '[]'); } catch(e){}
        try { core.evts = JSON.parse(localStorage.getItem('v11_evts') || '[]'); } catch(e){}
        try { core.sessions = JSON.parse(localStorage.getItem('v11_sessions') || '{}'); } catch(e){}
        core.currSessId = localStorage.getItem('v11_curr_id');
        
        if(!core.currSessId || !core.sessions[core.currSessId]) core.newSession();
        else core.loadSession(core.currSessId);

        core.renderEvt();
        setInterval(core.clockTick, 1000);
    },

    clockTick: () => {
        const n = new Date();
        const cn = new Date(n.getTime()+(n.getTimezoneOffset()*60000)+(3600000*8));
        const ny = new Date(n.toLocaleString("en-US",{timeZone:"America/New_York"}));
        document.getElementById('t-cn').innerText = `${String(cn.getHours()).padStart(2,'0')}:${String(cn.getMinutes()).padStart(2,'0')}`;
        document.getElementById('t-ny').innerText = `${String(ny.getHours()).padStart(2,'0')}:${String(ny.getMinutes()).padStart(2,'0')}`;
    },

    preset: (t) => {
        const d = t==='ds' ? ['https://api.deepseek.com/chat/completions','deepseek-chat'] : ['https://api.openai.com/v1/chat/completions','gpt-4o'];
        document.getElementById('c-url').value = d[0]; document.getElementById('c-mod').value = d[1];
    },
    saveConn: () => {
        core.conf.url = document.getElementById('c-url').value;
        core.conf.key = document.getElementById('c-key').value;
        core.conf.model = document.getElementById('c-mod').value;
        core.conf.persona = document.getElementById('c-per').value;
        ['url','key','model','persona'].forEach(k => localStorage.setItem('v11_'+k, core.conf[k]));
        alert('Saved.');
    },
    setVoiceMode: (m) => { core.voiceConf.mode = m; core.updateVoiceUI(); },
    updateVoiceUI: () => {
        document.getElementById('v-mode-disp').value = core.voiceConf.mode.toUpperCase();
        document.getElementById('openai-voice-opts').style.display = core.voiceConf.mode === 'openai' ? 'block' : 'none';
        document.getElementById('v-key').value = core.voiceConf.key;
        document.getElementById('v-voice').value = core.voiceConf.voice;
    },
    saveVoice: () => {
        core.voiceConf.key = document.getElementById('v-key').value;
        core.voiceConf.voice = document.getElementById('v-voice').value;
        localStorage.setItem('v11_voice', JSON.stringify(core.voiceConf));
        alert('Voice Saved.');
    },
    toggleAutoTTS: () => { core.autoTTS = !core.autoTTS; document.getElementById('tts-indicator').classList.toggle('active', core.autoTTS); if(core.autoTTS) core.speak("Audio On", true); },

    handleImg: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    let w=img.width, h=img.height, max=800;
                    if(w>max||h>max){ if(w>h){h*=max/w;w=max}else{w*=max/h;h=max} }
                    canvas.width=w; canvas.height=h; ctx.drawImage(img,0,0,w,h);
                    core.currUpload.img = canvas.toDataURL('image/jpeg', 0.7);
                    ui.addPreview('img', core.currUpload.img, '');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    handleFile: async (input) => {
        if (input.files && input.files[0]) {
            const f = input.files[0];
            const name = f.name;
            let text = "";
            ui.addPreview('file', null, "Parsing " + name + "...");
            try {
                if(name.endsWith('.pdf')) {
                    const arrayBuffer = await f.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map(item => item.str).join(' ') + "\n";
                    }
                } else if(name.endsWith('.docx')) {
                    const arrayBuffer = await f.arrayBuffer();
                    const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
                    text = result.value;
                } else {
                    text = await f.text(); // txt, md
                }
                core.currUpload.fileText = text; core.currUpload.fileName = name;
                ui.clearPreviews(); ui.addPreview('file', null, name);
            } catch(e) {
                alert("Parse Error: " + e.message); ui.clearPreviews();
            }
        }
    },
    clearPreview: (t) => {
        if(t==='img') core.currUpload.img = null;
        if(t==='file') { core.currUpload.fileText = null; core.currUpload.fileName = null; }
        ui.clearPreviews();
        document.getElementById('img-input').value=''; document.getElementById('file-input').value='';
    },

    regenerate: () => {
        const sess = core.sessions[core.currSessId];
        if(!sess || sess.msgs.length === 0) return;
        if(sess.msgs[sess.msgs.length-1].role === 'assistant') {
            sess.msgs.pop();
            const lastUserMsg = sess.msgs.pop();
            core.saveSessions();
            core.loadSession(core.currSessId);
            if(lastUserMsg) {
                document.getElementById('u-in').value = lastUserMsg.content;
                if(lastUserMsg.img) core.currUpload.img = lastUserMsg.img; 
                if(lastUserMsg.file) { core.currUpload.fileName = lastUserMsg.file; }
                core.send();
            }
        }
    },

    send: async () => {
        const el = document.getElementById('u-in'); const txt = el.value.trim();
        if((!txt && !core.currUpload.img && !core.currUpload.fileText) || !core.conf.key) return;
        
        const sess = core.sessions[core.currSessId];
        if(sess.msgs.length===0 && txt) { sess.title = txt.substring(0,12)+'...'; document.getElementById('header-title').innerText = sess.title; }

        ui.bubble('user', txt, core.currUpload.img, core.currUpload.fileName);
        
        let finalText = txt;
        if(core.currUpload.fileText) finalText += `\n\n[FILE CONTENT: ${core.currUpload.fileName}]\n${core.currUpload.fileText}\n[END FILE]`;
        
        let apiContent;
        if (core.currUpload.img) {
            apiContent = [ { type: "text", text: finalText || "Image." }, { type: "image_url", image_url: { url: core.currUpload.img } } ];
        } else { apiContent = finalText; }

        sess.msgs.push({role:'user', content:txt, img:core.currUpload.img, file:core.currUpload.fileName});
        core.saveSessions();

        const wasImg = core.currUpload.img;
        core.currUpload = { img:null, fileText:null, fileName:null };
        el.value=''; ui.clearPreviews();
        
        const aiDiv = ui.bubble('ai', 'Thinking...');

        let sys = core.conf.persona + `\n[Time:${new Date().toLocaleString()}]`;
        if(core.evts.length) sys += `\n[Schedule]:\n${core.evts.map(e=>`- ${e.t} ${e.d} (${e.n})`).join('\n')}`;
        const hits = core.mems.filter(m => m.keys.some(k => txt.includes(k)));
        if(hits.length) sys += `\n[Memory]:\n${hits.map(h=>`- ${h.info}`).join('\n')}`;

        const apiMsgs = [{role:'system', content:sys}];
        sess.msgs.forEach(m => {
            if(m === sess.msgs[sess.msgs.length-1]) {
                apiMsgs.push({role:'user', content: apiContent});
            } else {
                apiMsgs.push({role:m.role, content:m.content + (m.file?` [File: ${m.file} sent]`:'')});
            }
        });

        if(wasImg && core.conf.url.includes('deepseek')) { aiDiv.innerHTML = "Error: DeepSeek cannot see images."; sess.msgs.pop(); return; }

        try {
            const res = await fetch(core.conf.url, {
                method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${core.conf.key}`},
                body: JSON.stringify({ model:core.conf.model, messages:apiMsgs, stream:true })
            });
            const r = res.body.getReader(); const dec = new TextDecoder();
            let final = ''; aiDiv.innerHTML='';
            
            while(true) {
                const {done,value} = await r.read(); if(done) break;
                const chunk = dec.decode(value,{stream:true});
                chunk.split('\n').forEach(l => {
                    if(l.startsWith('data: ') && l!=='data: [DONE]') {
                        try { final += JSON.parse(l.slice(6)).choices[0].delta.content||''; aiDiv.innerHTML = marked.parse(final); } catch(e){}
                    }
                });
                document.getElementById('chat-box').scrollTop = 99999;
            }
            const now = new Date();
            aiDiv.innerHTML += `<div class="time">${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}</div>`;
            aiDiv.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY); };
            let timer;
            aiDiv.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY), 600); };
            aiDiv.ontouchend = () => clearTimeout(timer);
            aiDiv.ontouchmove = () => clearTimeout(timer);
            aiDiv.innerHTML += `<div class="replay-btn" onclick="core.speak('${final.replace(/'/g, "\\'").replace(/\n/g, ' ')}', true)">🔈 Replay</div>`;

            sess.msgs.push({role:'assistant', content:final});
            core.saveSessions();
            if(core.autoTTS) core.speak(final);
        } catch(e) { aiDiv.innerHTML = 'Error: '+e.message; }
    },

    speak: async (text, force=false) => {
        if(!core.autoTTS && !force) return;
        const plain = text.replace(/[*#`]/g, '');
        if(core.voiceConf.mode === 'native') {
            const u = new SpeechSynthesisUtterance(plain);
            const voices = speechSynthesis.getVoices();
            const zh = voices.find(v => v.lang.includes('zh'));
            if(zh) u.voice = zh;
            speechSynthesis.speak(u);
        } else {
            const k = core.voiceConf.key || core.conf.key;
            if(!k) return;
            try {
                const res = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST', headers: { 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: "tts-1", input: plain, voice: core.voiceConf.voice })
                });
                const blob = await res.blob(); new Audio(URL.createObjectURL(blob)).play();
            } catch(e) {}
        }
    },
    newSession: () => { const id = Date.now().toString(); core.sessions[id] = {id, title:'New Chat', msgs:[]}; core.currSessId=id; core.saveSessions(); core.loadSession(id); ui.toggleSidebar(false); },
    loadSession: (id) => { if(!core.sessions[id]) return; core.currSessId=id; localStorage.setItem('v11_curr_id', id); document.getElementById('header-title').innerText=core.sessions[id].title; const box=document.getElementById('chat-box'); box.innerHTML=''; core.sessions[id].msgs.forEach(m=>ui.bubble(m.role==='assistant'?'ai':'user', m.content, m.img, m.file)); },
    saveSessions: () => localStorage.setItem('v11_sessions', JSON.stringify(core.sessions)),
    renderSessionList: () => { const list=document.getElementById('session-list'); list.innerHTML=''; Object.keys(core.sessions).sort().reverse().forEach(id=>{ const s=core.sessions[id]; const div=document.createElement('div'); div.className=`sb-item ${id===core.currSessId?'active':''}`; div.innerHTML=`${s.title}<button class="sb-del" onclick="core.delSess('${id}', event)">×</button>`; div.onclick=()=>{core.loadSession(id);ui.toggleSidebar(false);}; list.appendChild(div); }); },
    delSess: (id, e) => { e.stopPropagation(); if(!confirm('Delete?')) return; delete core.sessions[id]; core.saveSessions(); if(core.currSessId===id) core.newSession(); else core.renderSessionList(); },
    addMem: () => { const k=document.getElementById('new-mem-keys').value.trim(); const i=document.getElementById('new-mem-info').value.trim(); if(k&&i) { core.mems.push({keys:k.split(/[,，\s]+/).filter(k=>k), info:i}); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); document.getElementById('new-mem-keys').value=''; document.getElementById('new-mem-info').value=''; } },
    delMem: (i) => { core.mems.splice(i,1); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); },
    renderMemCards: () => { const b=document.getElementById('mem-list-container'); b.innerHTML=''; core.mems.forEach((m,i)=>{ b.innerHTML+=`<div class="mem-card"><div class="mem-keys"># ${m.keys.join(', ')}</div><div class="mem-info">${m.info}</div><button class="mem-del" onclick="core.delMem(${i})">×</button></div>`; }); },
    addEv: async () => { const t=document.getElementById('ev-t').value; const d=document.getElementById('ev-txt').value; if(d) { const ev={id:Date.now(),t,d,n:'Reviewing...'}; core.evts.push(ev); core.evts.sort((a,b)=>a.t.localeCompare(b.t)); localStorage.setItem('v11_evts', JSON.stringify(core.evts)); core.renderEvt(); document.getElementById('ev-txt').value=''; if(core.conf.key) { try { const res=await fetch(core.conf.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${core.conf.key}`},body:JSON.stringify({model:core.conf.model,messages:[{role:'system',content:core.conf.persona},{role:'user',content:`Added: "${d}" at ${t}. Comment(Chinese, <15 chars):`}],stream:false})}); const j=await res.json(); ev.n=j.choices[0].message.content; localStorage.setItem('v11_evts',JSON.stringify(core.evts)); core.renderEvt(); } catch(e){} } } },
    delEv: (id) => { core.evts=core.evts.filter(e=>e.id!==id); localStorage.setItem('v11_evts', JSON.stringify(core.evts)); core.renderEvt(); },
    renderEvt: () => { const b=document.getElementById('evt-list'); b.innerHTML=''; core.evts.forEach(e=>{ b.innerHTML+=`<div class="evt"><div style="display:flex;justify-content:space-between"><b>${e.d}</b><span style="color:var(--accent)">${e.t}</span></div><div class="evt-n">${e.n}</div><button class="del" onclick="core.delEv(${e.id})">×</button></div>`; }); },
    exportData: () => { const d={conf:core.conf,voice:core.voiceConf,mems:core.mems,evts:core.evts,sessions:core.sessions}; const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='schiller_v11.json'; a.click(); },
    importData: (i) => { const r=new FileReader(); r.onload=(e)=>{ try { const d=JSON.parse(e.target.result); if(d.conf)['url','key','model','persona'].forEach(k=>localStorage.setItem('v11_'+k,d.conf[k])); if(d.voice)localStorage.setItem('v11_voice',JSON.stringify(d.voice)); if(d.mems)localStorage.setItem('v11_mems',JSON.stringify(d.mems)); if(d.evts)localStorage.setItem('v11_evts',JSON.stringify(d.evts)); if(d.sessions)localStorage.setItem('v11_sessions',JSON.stringify(d.sessions)); alert('Restored'); location.reload(); } catch(err){alert('Error');} }; r.readAsText(i.files[0]); }
};
core.init();