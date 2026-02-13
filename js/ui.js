// ==========================================
// USER INTERFACE (UI) MODULE
// ==========================================

const ui = {
    // 1. 主题与样式
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

    // 2. 页面与模态框导航
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
    modal: (s) => { 
        document.getElementById('set-modal').style.display = s ? 'flex' : 'none'; 
        if (s) core.renderMemCards(); 
    },
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

    // 3. 聊天气泡渲染
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

        // 长按呼出菜单
        d.oncontextmenu = (e) => { e.preventDefault(); ui.showCtx(e.pageX, e.pageY, role, msgIndex); };
        let timer;
        d.ontouchstart = (e) => { timer = setTimeout(() => ui.showCtx(e.touches[0].pageX, e.touches[0].pageY, role, msgIndex), 1000); };
        d.ontouchend = () => clearTimeout(timer);
        d.ontouchmove = () => clearTimeout(timer);

        const box = document.getElementById('chat-box'); box.appendChild(d); box.scrollTop = box.scrollHeight;
        return d;
    },
    
    // 4. 上下文菜单与预览区
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
    hideCtx: () => {
        const m = document.getElementById('ctx-menu');
        if(m) m.style.display = 'none';
    },

    addPreview: (type, src, name) => {
        const p = document.getElementById('preview-area');
        p.style.display = 'flex';
        const d = document.createElement('div'); d.className = 'preview-item';
        if (type === 'img') d.innerHTML = `<img src="${src}" class="preview-img"><span class="close-prev" onclick="core.clearPreview('img')">×</span>`;
        else d.innerHTML = `📄 ${name} <span class="close-prev" onclick="core.clearPreview('file')">×</span>`;
        p.appendChild(d);
    },
    clearPreviews: () => { 
        const p = document.getElementById('preview-area');
        if(p){ p.innerHTML = ''; p.style.display = 'none'; }
    },

    // 5. [新增] 开发者日志 (Changelog) 控制逻辑
    showLog: () => {
        const modal = document.getElementById('log-modal');
        const contentBox = document.getElementById('log-content');
        if (!modal || !contentBox) return;

        // 动态渲染日志内容
        contentBox.innerHTML = '';
        changelogData.forEach(log => {
            let html = `
                <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed var(--border);">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;">
                        <span style="font-size: 1.1rem; font-weight: bold; color: var(--accent);">${log.version}</span>
                        <span style="font-size: 0.8rem; color: var(--text-sub);">${log.date}</span>
                    </div>
                    <div style="font-weight: 600; margin-bottom: 8px;">${log.title}</div>
                    <ul style="margin: 0; padding-left: 20px; color: var(--text-sub); font-size: 0.9rem;">
            `;
            log.changes.forEach(item => { html += `<li style="margin-bottom: 5px;">${item}</li>`; });
            html += `</ul></div>`;
            contentBox.innerHTML += html;
        });

        modal.style.display = 'flex';
    },
    hideLog: () => {
        const modal = document.getElementById('log-modal');
        if(modal) modal.style.display = 'none';
    }
};