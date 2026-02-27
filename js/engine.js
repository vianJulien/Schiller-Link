// ==========================================
// CORE ENGINE MODULE (V1.5 - Universal + Claude Fix)
// ==========================================

Object.assign(core, {
    // 1. 系统初始化
    init: () => {
        ui.initTheme();
        
        // 读取配置
        Object.keys(core.conf).forEach(k => {
            const val = localStorage.getItem('v11_' + k);
            if(val !== null) core.conf[k] = val;
        });

        if (!core.conf.url) core.preset('ds');
        if (!core.conf.persona) core.conf.persona = "填写你的人设。";

        // 更新 UI 配置项
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setTxt = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };

        setVal('c-url', core.conf.url); setVal('c-key', core.conf.key); setVal('c-mod', core.conf.model);
        setVal('c-per', core.conf.persona); setVal('c-temp', core.conf.temp); setTxt('t-val', core.conf.temp);
        setVal('c-max', core.conf.maxTokens); setVal('c-freq', core.conf.freq); setTxt('val-freq', core.conf.freq);
        setVal('c-pres', core.conf.pres); setTxt('val-pres', core.conf.pres); setVal('c-min', core.conf.minOutput);

        ['warm', 'direct', 'intel', 'empathy', 'obed'].forEach(k => {
            const val = core.conf['p_' + k];
            setVal('rng-' + k, val); setTxt('val-' + k, val);
        });

        // 语音、记忆、日程、会话读取
        const v = localStorage.getItem('v11_voice'); if (v) core.voiceConf = JSON.parse(v); core.updateVoiceUI();
        try { core.mems = JSON.parse(localStorage.getItem('v11_mems') || '[]'); } catch (e) { }
        try { core.evts = JSON.parse(localStorage.getItem('v11_evts') || '[]'); } catch (e) { }
        try { core.sessions = JSON.parse(localStorage.getItem('v11_sessions') || '{}'); } catch (e) { }
        core.currSessId = localStorage.getItem('v11_curr_id');

        if (!core.currSessId || !core.sessions[core.currSessId]) core.newSession();
        else core.loadSession(core.currSessId);

        // 初始化日期与日历
        const now = new Date();
        core.selectedDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        if(typeof calendar !== 'undefined') {
            calendar.renderCalendar();
            calendar.renderEvt(); 
        }
        
        // 启动定时器
        setTimeout(core.checkDailyGreeting, 2000); 
        setInterval(core.clockTick, 1000);
    },

    // 2. 基础辅助
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

    // 3. 连接与保存模块
    saveConn: async () => {
        core.conf.url = document.getElementById('c-url').value.trim(); 
        core.conf.key = document.getElementById('c-key').value.trim();
        core.conf.model = document.getElementById('c-mod').value.trim(); 
        core.conf.persona = document.getElementById('c-per').value;
        core.conf.temp = document.getElementById('c-temp').value; 
        core.conf.maxTokens = document.getElementById('c-max').value;
        
        const elFreq = document.getElementById('c-freq'); if(elFreq) core.conf.freq = elFreq.value;
        const elPres = document.getElementById('c-pres'); if(elPres) core.conf.pres = elPres.value;
        const elMin = document.getElementById('c-min'); if(elMin) core.conf.minOutput = elMin.value;

        Object.keys(core.conf).forEach(k => {
            if (!k.startsWith('p_')) localStorage.setItem('v11_' + k, core.conf[k]);
        });

        if (!core.conf.url || !core.conf.key) {
            core.showToast('⚠️ 缺少配置', 'error');
            return;
        }
        await core.testConnection();
    },
    showToast: (msg, type = 'success') => {
        let toast = document.getElementById('vian-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'vian-toast';
            document.body.appendChild(toast);
        }
        const colors = { success: { bg: '#c0d1c0', text: '#6b5e59' }, error: { bg: '#dfc4c0', text: '#6b5e59' }, loading: { bg: '#f7f4ef', text: '#a39995' } };
        const theme = colors[type] || colors.success;
        toast.innerText = msg;
        toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${theme.bg};color:${theme.text};padding:12px 24px;border-radius:20px;box-shadow:0 8px 20px rgba(107,94,89,0.15);font-weight:bold;z-index:10000;transition:all 0.4s;opacity:0;top:-50px;pointer-events:none;`;
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.top = '30px'; });
        if (core.toastTimer) clearTimeout(core.toastTimer);
        core.toastTimer = setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '-50px'; }, 3000);
    },
    testConnection: async () => {
        core.showToast('正在连接...', 'loading');
        try {
            const res = await fetch(core.conf.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` },
                body: JSON.stringify({ model: core.conf.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
            });
            if (res.ok) core.showToast('✅ 连接成功', 'success');
            else core.showToast(`❌ 失败: ${res.status}`, 'error');
        } catch (e) { core.showToast('❌ 网络错误', 'error'); }
    },

    // 4. 性格引擎
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

    // 5. 语音模块
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

    // 6. 数据导入导出
    exportData: () => { const d = { conf: core.conf, voice: core.voiceConf, mems: core.mems, evts: core.evts, sessions: core.sessions }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'schiller_v15.json'; a.click(); },
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

    // 7. 记忆模块 (小写优化版)
    addMem: () => { const k = document.getElementById('new-mem-keys').value.trim(); const info = document.getElementById('new-mem-info').value.trim(); if (k && info) { core.mems.push({ keys: k.split(/[,，\s]+/).filter(k => k), info: info }); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); document.getElementById('new-mem-keys').value = ''; document.getElementById('new-mem-info').value = ''; } },
    delMem: (i) => { core.mems.splice(i, 1); localStorage.setItem('v11_mems', JSON.stringify(core.mems)); core.renderMemCards(); },
    renderMemCards: () => { const b = document.getElementById('mem-list-container'); b.innerHTML = ''; core.mems.forEach((m, i) => { b.innerHTML += `<div class="mem-card"><div class="mem-keys"># ${m.keys.join(', ')}</div><div class="mem-info">${m.info}</div><button class="mem-del" onclick="core.delMem(${i})">×</button></div>`; }); },

    // 8. 文件处理
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

    // 9. 会话管理
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
    newSession: () => { const id = Date.now().toString(); core.sessions[id] = { id, title: 'New Chat', msgs: [] }; core.currSessId = id; core.saveSessions(); core.loadSession(id); ui.toggleSidebar(false); },
    loadSession: (id) => { 
        if (!core.sessions[id]) return; 
        core.currSessId = id; localStorage.setItem('v11_curr_id', id); 
        document.getElementById('header-title').innerText = core.sessions[id].title; 
        const box = document.getElementById('chat-box'); box.innerHTML = ''; 
        core.sessions[id].msgs.forEach((m, i) => ui.bubble(m.role === 'assistant' ? 'ai' : 'user', m.content, m.img, m.file, i, m.time)); 
    },
    saveSessions: () => localStorage.setItem('v11_sessions', JSON.stringify(core.sessions)),
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
    delSess: (id, e) => { e.stopPropagation(); if (!confirm('Delete?')) return; delete core.sessions[id]; core.saveSessions(); if (core.currSessId === id) core.newSession(); else core.renderSessionList(); },

    // 10. 问候与发送 (含 Claude 修复版核心)
    checkDailyGreeting: () => {
        const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const lastGreet = localStorage.getItem('v11_last_greet');
        if (lastGreet !== today && core.conf.key) {
            const todayEvts = core.evts.filter(e => e.date === today);
            const planText = todayEvts.length > 0 ? `User's Today Schedule: ${todayEvts.map(e => e.t + ' ' + e.d).join(', ')}` : "User has no specific plans.";
            
            const sysPrompt = `
                [System Trigger]: Daily Greeting
                [Date]: ${today}
                [User Context]: ${planText}
                
                [Instruction]: 
                Based strictly on your persona settings below, initiate a greeting to the user.
                - Briefly mention the date or time if relevant to your character.
                - Comment on the user's schedule (or lack thereof) in your character's unique tone.
                - Do not wait for user input. Output the greeting immediately.

                [Current Persona]:
                ${core.conf.persona}
            `;
            core.triggerGreeting(sysPrompt);
            localStorage.setItem('v11_last_greet', today);
        }
    },
    triggerGreeting: async (sysPrompt) => {
        const sess = core.sessions[core.currSessId]; const aiIdx = sess.msgs.length; 
        const aiDiv = ui.bubble('ai', 'Writing daily greeting...', null, null, aiIdx);
        try {
            const res = await fetch(core.conf.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` }, body: JSON.stringify({ model: core.conf.model, messages: [{ role: 'system', content: sysPrompt }], stream: false }) });
            const data = await res.json(); const reply = data.choices[0].message.content;
            aiDiv.innerHTML = marked.parse(reply); const now = new Date(); const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${timeStr}</div>`;
            sess.msgs.push({ role: 'assistant', content: reply, time: timeStr }); core.saveSessions();
            if (core.autoTTS) core.speak(reply);
        } catch (e) { aiDiv.innerHTML = "Greeting Error: " + e.message; }
    },
    send: async () => {
        const el = document.getElementById('u-in'); const txt = el.value.trim();
        if ((!txt && !core.currUpload.img && !core.currUpload.fileText) || !core.conf.key) return;

        const sess = core.sessions[core.currSessId];
        if (sess.msgs.length === 0 && txt) { sess.title = txt.substring(0, 12) + '...'; document.getElementById('header-title').innerText = sess.title; }

        const now = new Date(); const userTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        sess.msgs.push({ role: 'user', content: txt, img: core.currUpload.img, file: core.currUpload.fileName, time: userTime });
        const userIdx = sess.msgs.length - 1;
        ui.bubble('user', txt, core.currUpload.img, core.currUpload.fileName, userIdx, userTime);

        let finalText = txt;
        if (core.currUpload.fileText) finalText += `\n\n[FILE CONTENT: ${core.currUpload.fileName}]\n${core.currUpload.fileText}\n[END FILE]`;
        let apiContent;
        if (core.currUpload.img) { apiContent = [{ type: "text", text: finalText || "Image." }, { type: "image_url", image_url: { url: core.currUpload.img } }]; } 
        else { apiContent = finalText; }

        core.saveSessions(); const wasImg = core.currUpload.img; core.currUpload = { img: null, fileText: null, fileName: null };
        el.value = ''; ui.clearPreviews();

        const aiIdx = sess.msgs.length; const aiDiv = ui.bubble('ai', 'Thinking...', null, null, aiIdx);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${days[now.getDay()]}`;

        let sys = core.conf.persona + `\n[Current Date: ${timeString}]\n` + core.generatePersonalityPrompt();
        
        const minVal = parseInt(core.conf.minOutput);
        if (!isNaN(minVal) && minVal > 0) { sys += `\n[强制指令]: 你的本次回复内容必须不少于 ${minVal} 个汉字/字符。请展开论述，增加细节描写、背景解释或逻辑推导，严禁提供短于此字数的简短回答。如果内容不足，请从更多维度深入探讨。\n`; }

        if (core.evts.length) {
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const futureEvts = core.evts.filter(e => e.date >= todayStr);
            if(futureEvts.length > 0) { sys += `\n[Upcoming Schedule]:\n${futureEvts.slice(0, 5).map(e => `- ${e.date} ${e.t} ${e.d} (${e.n})`).join('\n')}`; }
        }
        
        // 记忆检索优化：不区分大小写
        const hits = core.mems.filter(m => m.keys.some(k => txt.toLowerCase().includes(k.toLowerCase())));
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

            const res = await fetch(core.conf.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` }, body: JSON.stringify(reqBody) });
            
            // 【V1.5 核心修复：Claude 柔性解析器】
            const r = res.body.getReader(); const dec = new TextDecoder();
            let final = ''; aiDiv.innerHTML = '';
            let buffer = ''; 

            while (true) {
                const { done, value } = await r.read(); 
                if (done) break;
                
                buffer += dec.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    
                    if (trimmed.startsWith('data:')) {
                        try {
                            const jsonStr = trimmed.replace(/^data:\s*/, '');
                            const json = JSON.parse(jsonStr);
                            const content = json.choices?.[0]?.delta?.content || '';
                            
                            if (content) {
                                final += content;
                                aiDiv.innerHTML = marked.parse(final);
                                const chatBox = document.getElementById('chat-box');
                                if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
                            }
                        } catch (e) { console.error('Parse Error:', e); }
                    }
                }
            }

            const aiTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            aiDiv.innerHTML += `<div class="time">${aiTime}</div>`;
            aiDiv.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY, 'ai', aiIdx); };
            let timer; aiDiv.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY, 'ai', aiIdx), 1000); };
            aiDiv.ontouchend = () => clearTimeout(timer); aiDiv.ontouchmove = () => clearTimeout(timer);
            aiDiv.innerHTML += `<div class="replay-btn" onclick="core.speak('${final.replace(/'/g, "\\'").replace(/\n/g, ' ')}', true)">🔈 Replay</div>`;
            sess.msgs.push({ role: 'assistant', content: final, time: aiTime }); core.saveSessions();
            if (core.autoTTS) core.speak(final);
        } catch (e) { aiDiv.innerHTML = 'Error: ' + e.message; }
    }
});

// ==========================================
// BOOTSTRAP: 点火启动！
// ==========================================
core.init();