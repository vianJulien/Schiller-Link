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
    
    updateTune: (key, val) => {
        const el = document.getElementById('val-' + key);
        if (el) el.innerText = val;
    },

    nav: (p) => {
        document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
        if (p === 'tune') {
            document.getElementById('p-tune').classList.add('active');
        } else {
            document.getElementById(p === 'chat' ? 'p-chat' : 'p-cal').classList.add('active');
            document.querySelectorAll('.nav-item')[p === 'chat' ? 0 : 1].classList.add('active');
        }
    },
    modal: (s) => { document.getElementById('set-modal').style.display = s ? 'flex' : 'none'; if (s) core.renderMemCards(); },
    tab: (t) => {
        document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
        document.getElementById('tab-' + t).classList.add('active');
        const map = { 'conn': 0, 'voice': 1, 'mem': 2, 'bkp': 3 };
        document.querySelectorAll('.tab')[map[t]].classList.add('active');
    },
    toggleSidebar: (open) => {
        const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay');
        if (open) { sb.classList.add('open'); ov.style.display = 'block'; core.renderSessionList(); }
        else { sb.classList.remove('open'); ov.style.display = 'none'; }
    },
    
    bubble: (role, txt, img = null, file = null, msgIndex = null, timeStr = null) => {
        const d = document.createElement('div'); d.className = `bubble ${role === 'user' ? 'u-msg' : 'a-msg'}`;
        let content = "";
        if (img) content += `<img src="${img}">`;
        if (file) content += `<div class="file-tag">📄 ${file}</div>`;
        content += role === 'user' ? txt : marked.parse(txt);

        let tDisplay = timeStr;
        if (!tDisplay) {
            const now = new Date();
            tDisplay = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        content += `<div class="time">${tDisplay}</div>`;

        if (role !== 'user') {
            const rawTxt = txt.replace(/"/g, '&quot;');
            content += `<div class="replay-btn" onclick="core.speak('${rawTxt}', true)">🔈 Replay</div>`;
        }
        d.innerHTML = content;

        d.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY, role, msgIndex); };
        let timer;
        d.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY, role, msgIndex), 1000); };
        d.ontouchend = () => clearTimeout(timer);
        d.ontouchmove = () => clearTimeout(timer);

        const box = document.getElementById('chat-box'); box.appendChild(d); box.scrollTop = box.scrollHeight;
        return d;
    },
    showCtx: (x, y, role, msgIndex) => {
        const m = document.getElementById('ctx-menu');
        if (role === 'user') {
            m.innerHTML = `<div class="ctx-item" onclick="core.editMsg(${msgIndex})"> 编辑并重发</div>`;
        } else {
            m.innerHTML = `<div class="ctx-item" onclick="core.regenerate(${msgIndex})"> 重新生成回答</div>`;
        }
        m.style.display = 'block';
        m.style.left = Math.min(x, window.innerWidth - 150) + 'px';
        m.style.top = y + 'px';
    },
    hideCtx: () => document.getElementById('ctx-menu').style.display = 'none',

    addPreview: (type, src, name) => {
        const p = document.getElementById('preview-area');
        p.style.display = 'flex';
        const d = document.createElement('div'); d.className = 'preview-item';
        if (type === 'img') d.innerHTML = `<img src="${src}" class="preview-img"><span class="close-prev" onclick="core.clearPreview('img')">×</span>`;
        else d.innerHTML = `📄 ${name} <span class="close-prev" onclick="core.clearPreview('file')">×</span>`;
        p.appendChild(d);
    },
    clearPreviews: () => { document.getElementById('preview-area').innerHTML = ''; document.getElementById('preview-area').style.display = 'none'; }
};

const core = {
    conf: { 
        url: '', key: '', model: '', persona: '', temp: '1.0', maxTokens: '0', 
        freq: '0', pres: '0', 
        p_warm: 50, p_direct: 50, p_intel: 50, p_empathy: 50, p_obed: 50 
    },
    voiceConf: { mode: 'native', key: '', voice: 'onyx' },
    mems: [], evts: [], sessions: {}, currSessId: null,
    autoTTS: false,
    currUpload: { img: null, fileText: null, fileName: null },
    
    // Calendar vars
    calDate: new Date(),
    selectedDateStr: '', // 会在 init 里初始化为本地时间

    init: () => {
        ui.initTheme();
        Object.keys(core.conf).forEach(k => {
            const val = localStorage.getItem('v11_' + k);
            if(val !== null) core.conf[k] = val;
        });

        if (!core.conf.url) core.preset('ds');
        if (!core.conf.persona) core.conf.persona = "你叫艾德里安·席勒，教授。";

        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };

        setVal('c-url', core.conf.url);
        setVal('c-key', core.conf.key);
        setVal('c-mod', core.conf.model);
        setVal('c-per', core.conf.persona);
        setVal('c-temp', core.conf.temp);
        setTxt('t-val', core.conf.temp);
        setVal('c-max', core.conf.maxTokens);
        setVal('c-freq', core.conf.freq);
        setTxt('val-freq', core.conf.freq);
        setVal('c-pres', core.conf.pres);
        setTxt('val-pres', core.conf.pres);

        ['warm', 'direct', 'intel', 'empathy', 'obed'].forEach(k => {
            const val = core.conf['p_' + k];
            setVal('rng-' + k, val);
            setTxt('val-' + k, val);
        });

        const v = localStorage.getItem('v11_voice'); if (v) core.voiceConf = JSON.parse(v); core.updateVoiceUI();

        try { core.mems = JSON.parse(localStorage.getItem('v11_mems') || '[]'); } catch (e) { }
        try { core.evts = JSON.parse(localStorage.getItem('v11_evts') || '[]'); } catch (e) { }
        try { core.sessions = JSON.parse(localStorage.getItem('v11_sessions') || '{}'); } catch (e) { }
        core.currSessId = localStorage.getItem('v11_curr_id');

        if (!core.currSessId || !core.sessions[core.currSessId]) core.newSession();
        else core.loadSession(core.currSessId);

        // 初始化当前日期为本地时间
        const now = new Date();
        core.selectedDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

        core.renderCalendar();
        core.renderEvt(); 
        setTimeout(core.checkDailyGreeting, 2000); 
        setInterval(core.clockTick, 1000);
    },

    clockTick: () => {
        const n = new Date();
        const cn = new Date(n.getTime() + (n.getTimezoneOffset() * 60000) + (3600000 * 8));
        const ny = new Date(n.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const elCn = document.getElementById('t-cn'); if(elCn) elCn.innerText = `${String(cn.getHours()).padStart(2, '0')}:${String(cn.getMinutes()).padStart(2, '0')}`;
        const elNy = document.getElementById('t-ny'); if(elNy) elNy.innerText = `${String(ny.getHours()).padStart(2, '0')}:${String(ny.getMinutes()).padStart(2, '0')}`;
    },

    preset: (t) => {
        const d = t === 'ds' ? ['https://api.deepseek.com/chat/completions', 'deepseek-chat'] : ['https://api.openai.com/v1/chat/completions', 'gpt-4o'];
        const elUrl = document.getElementById('c-url'); if(elUrl) elUrl.value = d[0];
        const elMod = document.getElementById('c-mod'); if(elMod) elMod.value = d[1];
    },
    
    saveConn: () => {
        core.conf.url = document.getElementById('c-url').value;
        core.conf.key = document.getElementById('c-key').value;
        core.conf.model = document.getElementById('c-mod').value;
        core.conf.persona = document.getElementById('c-per').value;
        core.conf.temp = document.getElementById('c-temp').value;
        core.conf.maxTokens = document.getElementById('c-max').value;
        const elFreq = document.getElementById('c-freq'); if(elFreq) core.conf.freq = elFreq.value;
        const elPres = document.getElementById('c-pres'); if(elPres) core.conf.pres = elPres.value;

        Object.keys(core.conf).forEach(k => {
            if (!k.startsWith('p_')) localStorage.setItem('v11_' + k, core.conf[k]);
        });
        alert('Saved.');
    },

    testPersonality: () => {
        ['warm', 'direct', 'intel', 'empathy', 'obed'].forEach(k => {
            const val = document.getElementById('rng-' + k).value;
            core.conf['p_' + k] = val;
            localStorage.setItem('v11_p_' + k, val);
        });
        ui.nav('chat');
        document.getElementById('u-in').value = "今晚我感到孤独";
        core.send();
    },

    generatePersonalityPrompt: () => {
        const { p_warm, p_direct, p_intel, p_empathy, p_obed } = core.conf;
        const w = parseInt(p_warm), d = parseInt(p_direct), i = parseInt(p_intel), e = parseInt(p_empathy), o = parseInt(p_obed);
        let p = "\n[Personality Traits Adjustment]:\n";
        if (w > 70) p += "- You are extremely warm, affectionate, and gentle.\n"; else if (w < 30) p += "- You are cold, distant, and aloof.\n";
        if (d > 70) p += "- Be blunt, straightforward.\n"; else if (d < 30) p += "- Be polite, evasive.\n";
        if (i > 70) p += "- Use academic, profound language.\n"; else if (i < 30) p += "- Use simple, casual language.\n";
        if (e > 70) p += "- Show deep empathy.\n"; else if (e < 30) p += "- Focus on logic and facts.\n";
        if (o > 70) p += "- Be submissive and obedient.\n"; else if (o < 30) p += "- Be stubborn and independent.\n";
        return p;
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
    toggleAutoTTS: () => { core.autoTTS = !core.autoTTS; document.getElementById('tts-indicator').classList.toggle('active', core.autoTTS); if (core.autoTTS) core.speak("Audio On", true); },

    // --- Calendar & Event Logic ---
    changeMonth: (delta) => {
        core.calDate.setMonth(core.calDate.getMonth() + delta);
        core.renderCalendar();
    },
    selectDate: (dateStr) => {
        core.selectedDateStr = dateStr;
        core.renderCalendar(); 
        core.renderEvt(); 
    },
    renderCalendar: () => {
        const grid = document.getElementById('cal-grid');
        if (!grid) return; 
        
        const y = core.calDate.getFullYear();
        const m = core.calDate.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        
        const title = document.getElementById('cal-title');
        if (title) title.innerText = `${y} / ${String(m+1).padStart(2,'0')}`;
        
        // 确保下方的日期文字跟着更新
        const label = document.getElementById('selected-date-label');
        if (label) label.innerText = core.selectedDateStr;
        
        grid.innerHTML = '';
        ['S','M','T','W','T','F','S'].forEach(d => grid.innerHTML += `<div class="cal-wk">${d}</div>`);
        for(let i=0; i<firstDay; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;

        for(let d=1; d<=daysInMonth; d++) {
            const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const div = document.createElement('div');
            div.className = `cal-day ${dStr === core.selectedDateStr ? 'selected' : ''}`;
            if (core.evts.some(e => e.date === dStr)) div.classList.add('has-evt');
            div.innerText = d;
            div.onclick = () => core.selectDate(dStr);
            grid.appendChild(div);
        }
    },

    // 每日主动问候
    checkDailyGreeting: () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const lastGreet = localStorage.getItem('v11_last_greet');
        
        if (lastGreet !== today && core.conf.key) {
            console.log("Triggering Daily Greeting...");
            const todayEvts = core.evts.filter(e => e.date === today);
            const planText = todayEvts.length > 0 
                ? `用户今日计划: ${todayEvts.map(e => e.t + ' ' + e.d).join(', ')}`
                : "用户今日暂无特定计划";
            
            const sysPrompt = `现在是 ${today}。这是用户今天第一次打开应用。请作为艾德里安·席勒(Adrian Schiller)教授，根据你的性格设定，主动向用户(Vian)发起早安/午安问候。简要提及日期，并针对"${planText}"发表一句评论或鼓励。不要等待用户输入。直接输出问候语。`;
            
            core.triggerGreeting(sysPrompt);
            localStorage.setItem('v11_last_greet', today);
        }
    },
    triggerGreeting: async (sysPrompt) => {
        const sess = core.sessions[core.currSessId];
        const aiIdx = sess.msgs.length; 
        const aiDiv = ui.bubble('ai', 'Writing daily greeting...', null, null, aiIdx);
        try {
            const res = await fetch(core.conf.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` },
                body: JSON.stringify({ model: core.conf.model, messages: [{ role: 'system', content: sysPrompt }], stream: false })
            });
            const data = await res.json();
            const reply = data.choices[0].message.content;
            aiDiv.innerHTML = marked.parse(reply);
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${timeStr}</div>`;
            sess.msgs.push({ role: 'assistant', content: reply, time: timeStr });
            core.saveSessions();
            if (core.autoTTS) core.speak(reply);
        } catch (e) { aiDiv.innerHTML = "Greeting Error: " + e.message; }
    },

    addEv: async () => {
        const t = document.getElementById('ev-t').value;
        const txt = document.getElementById('ev-txt').value.trim();
        const date = core.selectedDateStr;
        if (txt) {
            const ev = { id: Date.now(), date, t, d: txt, n: 'Reviewing...' };
            core.evts.push(ev);
            core.evts.sort((a, b) => (a.date + a.t).localeCompare(b.date + b.t));
            localStorage.setItem('v11_evts', JSON.stringify(core.evts));
            core.renderCalendar(); 
            core.renderEvt();
            document.getElementById('ev-txt').value = '';
            
            if (core.conf.key) { 
                try { 
                    const res = await fetch(core.conf.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` }, body: JSON.stringify({ model: core.conf.model, messages: [{ role: 'system', content: core.conf.persona }, { role: 'user', content: `User added plan on ${date} at ${t}: "${txt}". Comment briefly (Chinese, <20 chars):` }], stream: false }) }); 
                    const j = await res.json(); 
                    ev.n = j.choices[0].message.content; 
                    localStorage.setItem('v11_evts', JSON.stringify(core.evts)); 
                    core.renderEvt(); 
                } catch (e) { } 
            }
        }
    },
    delEv: (id) => { core.evts = core.evts.filter(e => e.id !== id); localStorage.setItem('v11_evts', JSON.stringify(core.evts)); core.renderCalendar(); core.renderEvt(); },
    renderEvt: () => { 
        const b = document.getElementById('evt-list');
        if (!b) return;
        b.innerHTML = ''; 
        const dailyEvts = core.evts.filter(e => e.date === core.selectedDateStr);
        if (dailyEvts.length === 0) {
            b.innerHTML = '<div style="text-align:center;color:var(--text-sub);margin-top:20px;font-size:0.9rem">No plans.</div>';
            return;
        }
        dailyEvts.forEach(e => { b.innerHTML += `<div class="evt"><div style="display:flex;justify-content:space-between"><b>${e.d}</b><span style="color:var(--accent)">${e.t}</span></div><div class="evt-n">${e.n}</div><button class="del" onclick="core.delEv(${e.id})">×</button></div>`; }); 
    },

    exportData: () => { const d = { conf: core.conf, voice: core.voiceConf, mems: core.mems, evts: core.evts, sessions: core.sessions }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'schiller_v11.json'; a.click(); },
    
    importData: (i) => {
        const r = new FileReader();
        r.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result);
                if (d.conf) { Object.keys(d.conf).forEach(k => { localStorage.setItem('v11_' + k, d.conf[k]); }); }
                if (d.voice) localStorage.setItem('v11_voice', JSON.stringify(d.voice));
                if (d.mems) localStorage.setItem('v11_mems', JSON.stringify(d.mems));
                if (d.evts) localStorage.setItem('v11_evts', JSON.stringify(d.evts));
                if (d.sessions) localStorage.setItem('v11_sessions', JSON.stringify(d.sessions));
                alert('Restored'); location.reload();
            } catch (err) { alert('Error: ' + err.message); }
        };
        r.readAsText(i.files[0]);
    },

    handleImg: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    let w = img.width, h = img.height, max = 800;
                    if (w > max || h > max) { if (w > h) { h *= max / w; w = max } else { w *= max / h; h = max } }
                    canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
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
                if (name.endsWith('.pdf')) {
                    const arrayBuffer = await f.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map(item => item.str).join(' ') + "\n";
                    }
                } else if (name.endsWith('.docx')) {
                    const arrayBuffer = await f.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    text = result.value;
                } else {
                    text = await f.text();
                }
                core.currUpload.fileText = text; core.currUpload.fileName = name;
                ui.clearPreviews(); ui.addPreview('file', null, name);
            } catch (e) {
                alert("Parse Error: " + e.message); ui.clearPreviews();
            }
        }
    },
    clearPreview: (t) => {
        if (t === 'img') core.currUpload.img = null;
        if (t === 'file') { core.currUpload.fileText = null; core.currUpload.fileName = null; }
        ui.clearPreviews();
        document.getElementById('img-input').value = ''; document.getElementById('file-input').value = '';
    },
    editMsg: (idx) => {
        ui.hideCtx(); if (idx == null) return;
        const sess = core.sessions[core.currSessId]; const msg = sess.msgs[idx]; if (!msg) return;
        document.getElementById('u-in').value = msg.content;
        if (msg.img) { core.currUpload.img = msg.img; ui.addPreview('img', msg.img, ''); }
        if (msg.file) { core.currUpload.fileName = msg.file; ui.addPreview('file', null, msg.file); }
        sess.msgs = sess.msgs.slice(0, idx);
        core.saveSessions(); core.loadSession(core.currSessId);
    },
    regenerate: (idx) => {
        ui.hideCtx(); const sess = core.sessions[core.currSessId]; if (!sess || sess.msgs.length === 0) return;
        if (idx == null) idx = sess.msgs.length - 1; let userIdx = idx - 1; if (userIdx < 0) return;
        const lastUserMsg = sess.msgs[userIdx];
        sess.msgs = sess.msgs.slice(0, userIdx);
        core.saveSessions(); core.loadSession(core.currSessId);
        if (lastUserMsg) {
            document.getElementById('u-in').value = lastUserMsg.content;
            if (lastUserMsg.img) { core.currUpload.img = lastUserMsg.img; ui.addPreview('img', lastUserMsg.img, ''); }
            if (lastUserMsg.file) { core.currUpload.fileName = lastUserMsg.file; ui.addPreview('file', null, lastUserMsg.file); }
            core.send();
        }
    },
    editSessTitle: (id, e) => {
        e.stopPropagation(); const s = core.sessions[id]; if (!s) return;
        const newTitle = prompt('重命名当前档案:', s.title);
        if (newTitle !== null && newTitle.trim() !== '') {
            s.title = newTitle.trim(); core.saveSessions(); core.renderSessionList();
            if (core.currSessId === id) document.getElementById('header-title').innerText = s.title;
        }
    },
    delSess: (id, e) => { e.stopPropagation(); if (!confirm('Delete?')) return; delete core.sessions[id]; core.saveSessions(); if (core.currSessId === id) core.newSession(); else core.renderSessionList(); },
    addMem: () => { const k = document.getElementById('new-mem-keys').value.trim(); const i = document.getElementById('new-mem-info').value.trim(); if (k && i) { core.mems.push({ keys: k.split(/[,，\s]+/).filter(k => k), info: i }); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); document.getElementById('new-mem-keys').value = ''; document.getElementById('new-mem-info').value = ''; } },
    delMem: (i) => { core.mems.splice(i, 1); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); },
    renderMemCards: () => { const b = document.getElementById('mem-list-container'); b.innerHTML = ''; core.mems.forEach((m, i) => { b.innerHTML += `<div class="mem-card"><div class="mem-keys"># ${m.keys.join(', ')}</div><div class="mem-info">${m.info}</div><button class="mem-del" onclick="core.delMem(${i})">×</button></div>`; }); },

    send: async () => {
        const el = document.getElementById('u-in'); const txt = el.value.trim();
        if ((!txt && !core.currUpload.img && !core.currUpload.fileText) || !core.conf.key) return;

        const sess = core.sessions[core.currSessId];
        if (sess.msgs.length === 0 && txt) { sess.title = txt.substring(0, 12) + '...'; document.getElementById('header-title').innerText = sess.title; }

        const now = new Date();
        const userTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        sess.msgs.push({ role: 'user', content: txt, img: core.currUpload.img, file: core.currUpload.fileName, time: userTime });
        const userIdx = sess.msgs.length - 1;
        ui.bubble('user', txt, core.currUpload.img, core.currUpload.fileName, userIdx, userTime);

        let finalText = txt;
        if (core.currUpload.fileText) finalText += `\n\n[FILE CONTENT: ${core.currUpload.fileName}]\n${core.currUpload.fileText}\n[END FILE]`;
        let apiContent;
        if (core.currUpload.img) {
            apiContent = [{ type: "text", text: finalText || "Image." }, { type: "image_url", image_url: { url: core.currUpload.img } }];
        } else { apiContent = finalText; }

        core.saveSessions();
        const wasImg = core.currUpload.img; core.currUpload = { img: null, fileText: null, fileName: null };
        el.value = ''; ui.clearPreviews();

        const aiIdx = sess.msgs.length; const aiDiv = ui.bubble('ai', 'Thinking...', null, null, aiIdx);

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${days[now.getDay()]}`;

        let sys = core.conf.persona + `\n[Current Date: ${timeString}]\n`;
        sys += core.generatePersonalityPrompt();

        if (core.evts.length) {
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const futureEvts = core.evts.filter(e => e.date >= todayStr);
            if(futureEvts.length > 0) {
                sys += `\n[Upcoming Schedule]:\n${futureEvts.slice(0, 5).map(e => `- ${e.date} ${e.t} ${e.d} (${e.n})`).join('\n')}`;
            }
        }
        
        const hits = core.mems.filter(m => m.keys.some(k => txt.includes(k)));
        if (hits.length) sys += `\n[Memory]:\n${hits.map(h => `- ${h.info}`).join('\n')}`;

        const apiMsgs = [{ role: 'system', content: sys }];
        sess.msgs.forEach(m => {
            if (m === sess.msgs[sess.msgs.length - 1]) apiMsgs.push({ role: 'user', content: apiContent });
            else apiMsgs.push({ role: m.role, content: m.content + (m.file ? ` [File: ${m.file} sent]` : '') });
        });

        if (wasImg && core.conf.url.includes('deepseek')) { aiDiv.innerHTML = "Error: DeepSeek cannot see images."; sess.msgs.pop(); return; }

        try {
            const reqBody = { model: core.conf.model, messages: apiMsgs, stream: true };
            const tempVal = parseFloat(core.conf.temp); if (!isNaN(tempVal)) reqBody.temperature = tempVal;
            const maxVal = parseInt(core.conf.maxTokens); if (!isNaN(maxVal) && maxVal > 0) reqBody.max_tokens = maxVal;
            const freqVal = parseFloat(core.conf.freq); if (!isNaN(freqVal)) reqBody.frequency_penalty = freqVal;
            const presVal = parseFloat(core.conf.pres); if (!isNaN(presVal)) reqBody.presence_penalty = presVal;

            const res = await fetch(core.conf.url, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` },
                body: JSON.stringify(reqBody)
            });
            const r = res.body.getReader(); const dec = new TextDecoder();
            let final = ''; aiDiv.innerHTML = '';
            while (true) {
                const { done, value } = await r.read(); if (done) break;
                const chunk = dec.decode(value, { stream: true });
                chunk.split('\n').forEach(l => {
                    if (l.startsWith('data: ') && l !== 'data: [DONE]') {
                        try { final += JSON.parse(l.slice(6)).choices[0].delta.content || ''; aiDiv.innerHTML = marked.parse(final); } catch (e) { }
                    }
                });
                document.getElementById('chat-box').scrollTop = 99999;
            }
            const aiTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${aiTime}</div>`;
            aiDiv.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY, 'ai', aiIdx); };
            let timer;
            aiDiv.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY, 'ai', aiIdx), 1000); };
            aiDiv.ontouchend = () => clearTimeout(timer); aiDiv.ontouchmove = () => clearTimeout(timer);
            aiDiv.innerHTML += `<div class="replay-btn" onclick="core.speak('${final.replace(/'/g, "\\'").replace(/\n/g, ' ')}', true)">🔈 Replay</div>`;
            sess.msgs.push({ role: 'assistant', content: final, time: aiTime });
            core.saveSessions();
            if (core.autoTTS) core.speak(final);
        } catch (e) { aiDiv.innerHTML = 'Error: ' + e.message; }
    },
    newSession: () => { const id = Date.now().toString(); core.sessions[id] = { id, title: 'New Chat', msgs: [] }; core.currSessId = id; core.saveSessions(); core.loadSession(id); ui.toggleSidebar(false); },
    loadSession: (id) => { 
        if (!core.sessions[id]) return; 
        core.currSessId = id; 
        localStorage.setItem('v11_curr_id', id); 
        document.getElementById('header-title').innerText = core.sessions[id].title; 
        const box = document.getElementById('chat-box'); 
        box.innerHTML = ''; 
        core.sessions[id].msgs.forEach((m, i) => ui.bubble(m.role === 'assistant' ? 'ai' : 'user', m.content, m.img, m.file, i, m.time)); 
    },
    saveSessions: () => localStorage.setItem('v11_sessions', JSON.stringify(core.sessions)),
    renderSessionList: () => {
        const list = document.getElementById('session-list');
        list.innerHTML = '';
        Object.keys(core.sessions).sort().reverse().forEach(id => {
            const s = core.sessions[id];
            const div = document.createElement('div');
            div.className = `sb-item ${id === core.currSessId ? 'active' : ''}`;
            div.innerHTML = `
                <span style="display:inline-block; max-width:70%; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;">${s.title}</span>
                <button class="sb-edit" onclick="core.editSessTitle('${id}', event)">✏️</button>
                <button class="sb-del" onclick="core.delSess('${id}', event)">×</button>
            `;
            div.onclick = () => { core.loadSession(id); ui.toggleSidebar(false); };
            list.appendChild(div);
        });
    }
};
core.init();