// ==========================================
// 1. SYSTEM CONFIGURATION & STATE
// ==========================================

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const core = {
    conf: { 
        url: '', key: '', model: '', persona: '', temp: '1.0', maxTokens: '0', 
        freq: '0', pres: '0', minOutput: '0',
        apiFormat: 'openai', // 确保插座在这里
        p_warm: 50, p_direct: 50, p_intel: 50, p_empathy: 50, p_obed: 50 
    },
    voiceConf: { mode: 'native', key: '', voice: 'onyx' },
    
    mems: [], 
    evts: [], 
    sessions: {}, 
    currSessId: null,
    
    autoTTS: false,
    currUpload: { img: null, fileText: null, fileName: null },
    calDate: new Date(),
    selectedDateStr: ''
};

// ==========================================
// 2. DEVELOPER CHANGELOG (开发者日志数据)
// ==========================================
const changelogData = [
    {
        version: "v1.2",
        date: "2026-02-13",
        title: "系统架构大重构 & 多模型支持准备",
        changes: [
            "✨ [新增] 开发者专属 Update Log 页面",
            "✨ [新增] 准备接入 Google Gemini 原生底层协议",
            "🛠️ [优化] 彻底重构底层代码，拆分为模块化架构",
            "🐛 [修复] 修正了日历组件跨月份选中的潜在时区问题"
        ]
    },
    {
        version: "v1.1",
        date: "2026-02-12",
        title: "时间感知与规划系统",
        changes: [
            "✨ [新增] 全新 Plan 页面与可视化日历网格",
            "✨ [新增] AI 每日首次访问主动问候功能",
            "✨ [新增] 支持添加带有具体时间的日程安排",
            "🧠 [强化] AI 现在能感知当前时间与未来的用户计划"
        ]
    },
    {
        version: "v1.0",
        date: "2026-02-10",
        title: "TALK 破壳而出",
        changes: [
            "✨ [核心] 支持对接多种大语言模型 API",
            "✨ [核心] 建立 Personality Engine 动态性格调校系统",
            "✨ [核心] 实现多模态输入（图片、文档解析）",
            "✨ [核心] 加入本地记忆碎片（Memory）管理系统"
        ]
    }
];