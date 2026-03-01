// ==========================================
// CORE ENGINE MODULE (V2.2 - Memory Compressor)
// ==========================================
// Features: Hybrid Truncation, Session Isolation, Persona Cards, Memory Compression

Object.assign(core, {
    // 1. 系统初始化
    init: () => {
        ui.initTheme();
        
        // 读取配置
        Object.keys(core.conf).forEach(k => {
            const val = localStorage.getItem('v11_' + k);
            if(val !== null) core.conf[k] = val;
        });

        // 读取人设 & 记忆
        try { core.personas = JSON.parse(localStorage.getItem('v11_personas') || '{}'); } catch (e) { core.personas = {}; }
        try { core.mems = JSON.parse(localStorage.getItem('v11_mems') || '[]'); } catch (e) { }
        try { core.evts = JSON.parse(localStorage.getItem('v11_evts') || '[]'); } catch (e) { }
        try { core.sessions = JSON.parse(localStorage.getItem('v11_sessions') || '{}'); } catch (e) { }
        
        // UI 绑定
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };

        setVal('c-url', core.conf.url); setVal('c-key', core.conf.key); setVal('c-mod', core.conf.model);
        setVal('c-per', core.conf.persona); setVal('c-temp', core.conf.temp); setTxt('t-val', core.conf.temp);
        
        // 加载会话
        core.currSessId = localStorage.getItem('v11_curr_id');
        if (!core.currSessId || !core.sessions[core.currSessId]) core.newSession();
        else core.loadSession(core.currSessId);

        // 【V2.2 新增】自动注入功能按钮 (人设卡 + 记忆压缩)
        core.injectToolsUI();

        setTimeout(core.checkDailyGreeting, 2000); 
        setInterval(core.clockTick, 1000);
    },

    // 2. 界面注入 (Persona & Memory Tools)
    injectToolsUI: () => {
        // A. 人设工具
        const perBox = document.getElementById('c-per');
        if(perBox && !document.getElementById('persona-tools')) {
            const div = document.createElement('div');
            div.id = 'persona-tools';
            div.style.marginTop = '5px';
            div.innerHTML = `
                <button onclick="core.savePersonaCard()" style="font-size:12px;padding:4px 8px;cursor:pointer;margin-right:5px;">💾 存为人设</button>
                <button onclick="core.loadPersonaCard()" style="font-size:12px;padding:4px 8px;cursor:pointer;">📂 读取人设</button>
            `;
            perBox.parentNode.insertBefore(div, perBox.nextSibling);
        }

        // B. 记忆压缩工具 (注入到记忆列表上方)
        const memInput = document.getElementById('new-mem-keys');
        if(memInput && !document.getElementById('mem-tools')) {
            const div = document.createElement('div');
            div.id = 'mem-tools';
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <button onclick="core.compressSession()" style="width:100%; padding:8px; background:#e0e0e0; border:none; border-radius:4px; cursor:pointer; font-weight:bold; color:#333;">🧠 压缩当前对话至记忆 (Compress Chat)</button>
            `;
            memInput.parentNode.insertBefore(div, memInput);
        }
    },
    
    // 3. 【V2.2 核心】记忆压缩功能
    compressSession: async () => {
        const sess = core.sessions[core.currSessId];
        const cfg = sess.config || core.conf;
        
        if (sess.msgs.length < 2) return alert("对话太短，没必要压缩。");
        if (!confirm("确定要将当前的对话记录总结并存入记忆库吗？\n(这将消耗一次 API 调用)")) return;

        core.showToast('正在阅读并总结...', 'loading');

        // 构造总结请求
        const chatLog = sess.msgs.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `
            [System Instruction]: 
            You are a helpful assistant serving as a memory archivist.
            Read the following chat history between User and Assistant.
            Summarize the key events, facts, and character developments into a concise paragraph (max 100 words).
            The summary must be in the same language as the chat.
            
            [Chat History]:
            ${chatLog}
        `;

        try {
            const res = await fetch(cfg.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` },
                body: JSON.stringify({ 
                    model: cfg.model, 
                    messages: [{ role: 'user', content: prompt }], 
                    max_tokens: 500 
                })
            });
            const data = await res.json();
            const summary = data.choices[0].message.content;

            // 存入记忆库
            const dateStr = new Date().toLocaleDateString();
            core.mems.push({ 
                keys: ['Summary', '摘要', '前情提要'], 
                info: `[${dateStr} Summary]: ${summary}` 
            });
            localStorage.setItem('v11_mems', JSON.stringify(core.mems));
            core.renderMemCards();
            
            core.showToast('✅ 记忆已压缩保存');

            // 询问是否清空
            if (confirm(`摘要已生成：\n"${summary.substring(0, 50)}..."\n\n是否清空当前聊天记录，开始新的一章？`)) {
                sess.msgs = [];
                core.saveSessions();
                core.loadSession(core.currSessId);
            }

        } catch (e) {
            alert("压缩失败: " + e.message);
            core.showToast('❌ 压缩失败', 'error');
        }
    },

    // 4. 常规功能保持不变
    savePersonaCard: () => {
        const name = prompt("给当前人设起个名字:");
        if (name) {
            core.personas[name] = document.getElementById('c-per').value;
            localStorage.setItem('v11_personas', JSON.stringify(core.personas));
            core.showToast(`人设 [${name}] 已保存`);
        }
    },
    loadPersonaCard: () => {
        const names = Object.keys(core.personas);
        if (names.length === 0) return alert("无存档");
        const name = prompt("输入加载的人设名:\n" + names.join(", "));
        if (core.personas[name]) {
            document.getElementById('c-per').value = core.personas[name];
            core.saveConn();
            core.showToast(`人设 [${name}] 已加载`);
        }
    },
    newSession: () => { 
        const id = Date.now().toString(); 
        core.sessions[id] = { id, title: 'New Chat', msgs: [], config: { ...core.conf } }; 
        core.currSessId = id; 
        core.saveSessions(); 
        core.loadSession(id); 
        ui.toggleSidebar(false); 
    },
    loadSession: (id) => { 
        if (!core.sessions[id]) return; 
        core.currSessId = id; localStorage.setItem('v11_curr_id', id); 
        const sess = core.sessions[id];
        document.getElementById('header-title').innerText = sess.title; 
        if (!sess.config) sess.config = { ...core.conf }; 
        
        const set = (eid, key) => { const el = document.getElementById(eid); if(el) el.value = sess.config[key] || core.conf[key] || ''; };
        set('c-url', 'url'); set('c-key', 'key'); set('c-mod', 'model');
        set('c-per', 'persona'); set('c-temp', 'temp'); 
        
        const box = document.getElementById('chat-box'); box.innerHTML = ''; 
        sess.msgs.forEach((m, i) => ui.bubble(m.role === 'assistant' ? 'ai' : 'user', m.content, m.img, m.file, i, m.time)); 
    },
    saveSessions: () => localStorage.setItem('v11_sessions', JSON.stringify(core.sessions)),
    saveConn: async () => {
        const sess = core.sessions[core.currSessId];
        if (!sess.config) sess.config = {};
        sess.config.url = document.getElementById('c-url').value.trim(); 
        sess.config.key = document.getElementById('c-key').value.trim();
        sess.config.model = document.getElementById('c-mod').value.trim(); 
        sess.config.persona = document.getElementById('c-per').value;
        sess.config.temp = document.getElementById('c-temp').value; 
        core.conf = { ...core.conf, ...sess.config };
        Object.keys(core.conf).forEach(k => { if (!k.startsWith('p_')) localStorage.setItem('v11_' + k, core.conf[k]); });
        core.saveSessions();
        core.showToast('✅ 配置保存', 'success');
        await core.testConnection();
    },
    send: async () => {
        const el = document.getElementById('u-in'); const txt = el.value.trim();
        const sess = core.sessions[core.currSessId];
        const cfg = sess.config || core.conf; 

        if ((!txt && !core.currUpload.img && !core.currUpload.fileText) || !cfg.key) return;

        if (sess.msgs.length === 0 && txt) { sess.title = txt.substring(0, 12) + '...'; document.getElementById('header-title').innerText = sess.title; }
        const now = new Date(); const userTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        sess.msgs.push({ role: 'user', content: txt, img: core.currUpload.img, file: core.currUpload.fileName, time: userTime });
        ui.bubble('user', txt, core.currUpload.img, core.currUpload.fileName, sess.msgs.length - 1, userTime);

        let finalText = txt;
        if (core.currUpload.fileText) finalText += `\n\n[FILE: ${core.currUpload.fileName}]\n${core.currUpload.fileText}`;
        let apiContent = core.currUpload.img ? [{ type: "text", text: finalText || "Image." }, { type: "image_url", image_url: { url: core.currUpload.img } }] : finalText;

        core.saveSessions(); const wasImg = core.currUpload.img; core.currUpload = { img: null, fileText: null, fileName: null };
        el.value = ''; ui.clearPreviews();

        const aiDiv = ui.bubble('ai', 'Thinking...', null, null, sess.msgs.length);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dateStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${days[now.getDay()]}`;
        
        let sys = (cfg.persona || "You are a helpful assistant.") + `\n[Date: ${dateStr}]`;
        const hits = core.mems.filter(m => m.keys.some(k => txt.toLowerCase().includes(k.toLowerCase())));
        if (hits.length) sys += `\n[Memory]:\n${hits.map(h => `- ${h.info}`).join('\n')}`;

        // 混合截断逻辑 (Hybrid Truncation)
        const HISTORY_MSG_LIMIT = 10;   
        const MAX_CONTEXT_CHARS = 2000; 

        let historyCandidates = sess.msgs.slice(0, sess.msgs.length - 1).slice(-HISTORY_MSG_LIMIT);
        let currentChars = historyCandidates.reduce((acc, m) => acc + (m.content || '').length, 0);
        while (currentChars > MAX_CONTEXT_CHARS && historyCandidates.length > 0) {
            const removed = historyCandidates.shift(); 
            currentChars -= (removed.content || '').length;
        }

        const apiMsgs = [{ role: 'system', content: sys }];
        historyCandidates.forEach(m => {
            apiMsgs.push({ role: m.role, content: m.content + (m.img ? ' [Image sent]' : '') });
        });
        apiMsgs.push({ role: 'user', content: apiContent });

        if (wasImg && cfg.url.includes('deepseek')) { aiDiv.innerHTML = "DeepSeek cannot see images."; sess.msgs.pop(); return; }

        try {
            const reqBody = { model: cfg.model, messages: apiMsgs, stream: true };
            if (cfg.temp) reqBody.temperature = parseFloat(cfg.temp);
            
            const res = await fetch(cfg.url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` }, 
                body: JSON.stringify(reqBody) 
            });

            const r = res.body.getReader(); const dec = new TextDecoder();
            let final = ''; aiDiv.innerHTML = ''; let buffer = '';
            while (true) {
                const { done, value } = await r.read(); if(done) break;
                buffer += dec.decode(value, {stream:true});
                const lines = buffer.split('\n'); buffer = lines.pop();
                for(const line of lines) {
                    const t = line.trim();
                    if(t.startsWith('data:') && t!=='data: [DONE]') {
                        try {
                            const json = JSON.parse(t.replace(/^data:\s*/, ''));
                            const c = json.choices?.[0]?.delta?.content || '';
                            if(c) { final += c; aiDiv.innerHTML = marked.parse(final); document.getElementById('chat-box').scrollTop=99999; }
                        } catch(e){}
                    }
                }
            }
            const aiTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${aiTime}</div>`;
            sess.msgs.push({ role: 'assistant', content: final, time: aiTime }); 
            sess.config = cfg; 
            core.saveSessions();
            if (core.autoTTS) core.speak(final);
        } catch (e) { aiDiv.innerHTML = 'Error: ' + e.message; }
    },
    
    // 5. 辅助功能 (保持 V1.6)
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
    showToast: (msg, type = 'success') => {
        let toast = document.getElementById('vian-toast');
        if (!toast) { toast = document.createElement('div'); toast.id = 'vian-toast'; document.body.appendChild(toast); }
        const colors = { success: { bg: '#c0d1c0', text: '#6b5e59' }, error: { bg: '#dfc4c0', text: '#6b5e59' }, loading: { bg: '#f7f4ef', text: '#a39995' } };
        const theme = colors[type] || colors.success;
        toast.innerText = msg;
        toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${theme.bg};color:${theme.text};padding:12px 24px;border-radius:20px;box-shadow:0 8px 20px rgba(107,94,89,0.15);font-weight:bold;z-index:10000;transition:all 0.4s;opacity:0;top:-50px;pointer-events:none;`;
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.top = '30px'; });
        if (core.toastTimer) clearTimeout(core.toastTimer);
        core.toastTimer = setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '-50px'; }, 3000);
    },
    testConnection: async () => {
        const cfg = core.sessions[core.currSessId].config || core.conf;
        core.showToast('正在连接...', 'loading');
        try {
            const res = await fetch(cfg.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` },
                body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
            });
            if (res.ok) core.showToast('✅ 连接成功', 'success');
            else core.showToast(`❌ 失败: ${res.status}`, 'error');
        } catch (e) { core.showToast('❌ 网络错误', 'error'); }
    },
    exportData: () => { const d = { conf: core.conf, voice: core.voiceConf, mems: core.mems, evts: core.evts, sessions: core.sessions, personas: core.personas }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'schiller_v22.json'; a.click(); },
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
                if (d.personas) localStorage.setItem('v11_personas', JSON.stringify(d.personas));
                alert('Restored'); location.reload();
            } catch (err) { alert('Error: ' + err.message); }
        };
        r.readAsText(i.files[0]);
    },
    // 其他未修改的辅助函数
    setVoiceMode: (m) => { core.voiceConf.mode = m; core.updateVoiceUI(); },
    updateVoiceUI: () => {
        document.getElementById('v-mode-disp').value = core.voiceConf.mode.toUpperCase();
        document.getElementById('openai-voice-opts').style.display = core.voiceConf.mode === 'openai' ? 'block' : 'none';
        document.getElementById('v-key').value = core.voiceConf.key; document.getElementById('v-voice').value = core.voiceConf.voice;
    },
    saveVoice: () => {
        core.voiceConf.key = document.getElementById('v-key').value; core.voiceConf.voice = document.getElementById('v-voice').value;
        localStorage.setItem('v11_voice', JSON.stringify(core.voiceConf)); alert('Voice Saved.');
    },
    toggleAutoTTS: () => { core.autoTTS = !core.autoTTS; document.getElementById('tts-indicator').classList.toggle('active', core.autoTTS); if (core.autoTTS) core.speak("Audio On", true); },
    speak: async (text, force = false) => {
        if (!core.autoTTS && !force) return;
        if (core.voiceConf.mode !== 'openai') {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            if (core.voiceConf.voice) { const v = voices.find(v => v.name === core.voiceConf.voice); if (v) u.voice = v; }
            window.speechSynthesis.speak(u);
        } else if (core.voiceConf.key) {
            try {
                const res = await fetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${core.voiceConf.key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'tts-1', input: text, voice: core.voiceConf.voice || 'alloy' })
                });
                const blob = await res.blob();
                const audio = new Audio(URL.createObjectURL(blob));
                audio.play();
            } catch (e) { console.error('TTS Error:', e); }
        }
    },
    addMem: () => { const k = document.getElementById('new-mem-keys').value.trim(); const info = document.getElementById('new-mem-info').value.trim(); if (k && info) { core.mems.push({ keys: k.split(/[,，\s]+/).filter(k => k), info: info }); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); document.getElementById('new-mem-keys').value = ''; document.getElementById('new-mem-info').value = ''; } },
    delMem: (i) => { core.mems.splice(i, 1); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); },
    renderMemCards: () => { const b = document.getElementById('mem-list-container'); b.innerHTML = ''; core.mems.forEach((m, i) => { b.innerHTML += `<div class="mem-card"><div class="mem-keys"># ${m.keys.join(', ')}</div><div class="mem-info">${m.info}</div><button class="mem-del" onclick="core.delMem(${i})">×</button></div>`; }); },
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
            const f = input.files[0]; const name = f.name; let text = "";
            ui.addPreview('file', null, "Parsing " + name + "...");
            try {
                if (name.endsWith('.pdf')) {
                    const arrayBuffer = await f.arrayBuffer(); const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                    for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => item.str).join(' ') + "\n"; }
                } else if (name.endsWith('.docx')) {
                    const arrayBuffer = await f.arrayBuffer(); const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer }); text = result.value;
                } else { text = await f.text(); }
                core.currUpload.fileText = text; core.currUpload.fileName = name;
                ui.clearPreviews(); ui.addPreview('file', null, name);
            } catch (e) { alert("Parse Error: " + e.message); ui.clearPreviews(); }
        }
    },
    clearPreview: (t) => {
        if (t === 'img') core.currUpload.img = null;
        if (t === 'file') { core.currUpload.fileText = null; core.currUpload.fileName = null; }
        ui.clearPreviews(); document.getElementById('img-input').value = ''; document.getElementById('file-input').value = '';
    },
    editMsg: (idx) => {
        ui.hideCtx(); if (idx == null) return;
        const sess = core.sessions[core.currSessId]; const msg = sess.msgs[idx]; if (!msg) return;
        document.getElementById('u-in').value = msg.content;
        if (msg.img) { core.currUpload.img = msg.img; ui.addPreview('img', msg.img, ''); }
        if (msg.file) { core.currUpload.fileName = msg.file; ui.addPreview('file', null, msg.file); }
        sess.msgs = sess.msgs.slice(0, idx); core.saveSessions(); core.loadSession(core.currSessId);
    },
    regenerate: (idx) => {
        ui.hideCtx(); const sess = core.sessions[core.currSessId]; if (!sess || sess.msgs.length === 0) return;
        if (idx == null) idx = sess.msgs.length - 1; let userIdx = idx - 1; if (userIdx < 0) return;
        const lastUserMsg = sess.msgs[userIdx]; sess.msgs = sess.msgs.slice(0, userIdx);
        core.saveSessions(); core.loadSession(core.currSessId);
        if (lastUserMsg) {
            document.getElementById('u-in').value = lastUserMsg.content;
            if (lastUserMsg.img) { core.currUpload.img = lastUserMsg.img; ui.addPreview('img', lastUserMsg.img, ''); }
            if (lastUserMsg.file) { core.currUpload.fileName = lastUserMsg.file; ui.addPreview('file', null, lastUserMsg.file); }
            core.send();
        }
    },
    checkDailyGreeting: () => {
        const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const lastGreet = localStorage.getItem('v11_last_greet');
        const sess = core.sessions[core.currSessId];
        const cfg = sess.config || core.conf;

        if (lastGreet !== today && cfg.key) {
            const todayEvts = core.evts.filter(e => e.date === today);
            const planText = todayEvts.length > 0 ? `User's Today Schedule: ${todayEvts.map(e => e.t + ' ' + e.d).join(', ')}` : "User has no specific plans.";
            
            const sysPrompt = `[System Trigger]: Daily Greeting\n[Date]: ${today}\n[User Context]: ${planText}\n[Instruction]: Based strictly on your persona, greet the user.\n[Current Persona]:\n${cfg.persona}`;
            core.triggerGreeting(sysPrompt);
            localStorage.setItem('v11_last_greet', today);
        }
    },
    triggerGreeting: async (sysPrompt) => {
        const sess = core.sessions[core.currSessId]; 
        const cfg = sess.config || core.conf;
        const aiIdx = sess.msgs.length; 
        const aiDiv = ui.bubble('ai', 'Writing daily greeting...', null, null, aiIdx);
        try {
            const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.key}` }, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: sysPrompt }], stream: false }) });
            const data = await res.json(); const reply = data.choices[0].message.content;
            aiDiv.innerHTML = marked.parse(reply); const now = new Date(); const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${timeStr}</div>`;
            sess.msgs.push({ role: 'assistant', content: reply, time: timeStr }); core.saveSessions();
            if (core.autoTTS) core.speak(reply);
        } catch (e) { aiDiv.innerHTML = "Greeting Error: " + e.message; }
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
    generatePersonalityPrompt: () => { return ""; },
    renderSessionList: () => {
        const list = document.getElementById('session-list'); list.innerHTML = '';
        Object.keys(core.sessions).sort().reverse().forEach(id => {
            const s = core.sessions[id]; const div = document.createElement('div');
            div.className = `sb-item ${id === core.currSessId ? 'active' : ''}`;
            div.innerHTML = `<span style="display:inline-block; max-width:70%; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;">${s.title}</span><button class="sb-edit" onclick="core.editSessTitle('${id}', event)">✏️</button><button class="sb-del" onclick="core.delSess('${id}', event)">×</button>`;
            div.onclick = () => { core.loadSession(id); ui.toggleSidebar(false); };
            list.appendChild(div);
        });
    },
    editSessTitle: (id, e) => { e.stopPropagation(); const s = core.sessions[id]; if (!s) return; const newTitle = prompt('重命名当前档案:', s.title); if (newTitle !== null && newTitle.trim() !== '') { s.title = newTitle.trim(); core.saveSessions(); core.renderSessionList(); if (core.currSessId === id) document.getElementById('header-title').innerText = s.title; } },
    delSess: (id, e) => { e.stopPropagation(); if (!confirm('Delete?')) return; delete core.sessions[id]; core.saveSessions(); if (core.currSessId === id) core.newSession(); else core.renderSessionList(); }
});

// 启动
core.init();