// ==========================================
// CALENDAR & EVENTS MODULE
// ==========================================

const calendar = {
    // 切换月份
    changeMonth: (delta) => {
        core.calDate.setMonth(core.calDate.getMonth() + delta);
        calendar.renderCalendar();
    },
    
    // 选择日期
    selectDate: (dateStr) => {
        core.selectedDateStr = dateStr;
        calendar.renderCalendar(); 
        calendar.renderEvt(); 
    },
    
    // 渲染日历网格
    renderCalendar: () => {
        const grid = document.getElementById('cal-grid');
        if (!grid) return; 
        
        const y = core.calDate.getFullYear();
        const m = core.calDate.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        
        const title = document.getElementById('cal-title');
        if (title) title.innerText = `${y} / ${String(m+1).padStart(2,'0')}`;
        
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
            div.onclick = () => calendar.selectDate(dStr);
            grid.appendChild(div);
        }
    },

    // 添加计划 (包含 AI 短评)
    addEv: async () => {
        const t = document.getElementById('ev-t').value;
        const txt = document.getElementById('ev-txt').value.trim();
        const date = core.selectedDateStr;
        if (txt) {
            const ev = { id: Date.now(), date, t, d: txt, n: 'Reviewing...' };
            core.evts.push(ev);
            core.evts.sort((a, b) => (a.date + a.t).localeCompare(b.date + b.t));
            localStorage.setItem('v11_evts', JSON.stringify(core.evts));
            
            calendar.renderCalendar(); 
            calendar.renderEvt();
            document.getElementById('ev-txt').value = '';
            
            // 异步请求 AI 对计划的简短评价
            if (core.conf.key) { 
                try { 
                    const res = await fetch(core.conf.url, { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${core.conf.key}` }, 
                        body: JSON.stringify({ 
                            model: core.conf.model, 
                            messages: [
                                { role: 'system', content: core.conf.persona }, 
                                { role: 'user', content: `User added plan on ${date} at ${t}: "${txt}". Comment briefly (Chinese, <20 chars):` }
                            ], 
                            stream: false 
                        }) 
                    }); 
                    const j = await res.json(); 
                    ev.n = j.choices[0].message.content; 
                    localStorage.setItem('v11_evts', JSON.stringify(core.evts)); 
                    calendar.renderEvt(); 
                } catch (e) { console.error("Event comment failed", e); } 
            }
        }
    },
    
    // 删除计划
    delEv: (id) => { 
        core.evts = core.evts.filter(e => e.id !== id); 
        localStorage.setItem('v11_evts', JSON.stringify(core.evts)); 
        calendar.renderCalendar(); 
        calendar.renderEvt(); 
    },
    
    // 渲染当日计划列表
    renderEvt: () => { 
        const b = document.getElementById('evt-list');
        if (!b) return;
        b.innerHTML = ''; 
        const dailyEvts = core.evts.filter(e => e.date === core.selectedDateStr);
        if (dailyEvts.length === 0) {
            b.innerHTML = '<div style="text-align:center;color:var(--text-sub);margin-top:20px;font-size:0.9rem">No plans.</div>';
            return;
        }
        dailyEvts.forEach(e => { 
            b.innerHTML += `<div class="evt">
                <div style="display:flex;justify-content:space-between"><b>${e.d}</b><span style="color:var(--accent)">${e.t}</span></div>
                <div class="evt-n">${e.n}</div>
                <button class="del" onclick="calendar.delEv(${e.id})">×</button>
            </div>`; 
        }); 
    }
};
