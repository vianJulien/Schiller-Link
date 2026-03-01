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
        version: "v2.4",
        date: "2026-02-17", // 除夕/初一突击
        title: "永恒记忆与无损压缩 (The Eternal Memory)",
        changes: [
            "✨ [核心] 实现 Pinned Memory (记忆钉子)，摘要永久驻留后台，无视截断",
            "✨ [优化] 记忆压缩不再强制清空对话，实现“无损存档”与“连载模式”",
            "🐛 [修复] 找回了 V2.2 升级中丢失的日历初始化代码",
            "🧠 [策略] 完善了 DeepSeek (大纲) + Claude (正文) 的低成本协作流"
        ]
    },
    {
        version: "v2.2",
        date: "2026-02-17",
        title: "记忆压缩机 (The Memory Compressor)",
        changes: [
            "✨ [新增] 界面自动注入功能按钮 (无需手动修改 HTML)",
            "🧠 [核心] 接入 Summarization API，将长对话压缩为 100 字记忆",
            "✨ [新增] 人设卡系统：支持一键保存/读取多重人设 (Persona Cards)",
            "🛠️ [优化] 增加手动触发压缩的开关，让用户掌控存档节奏"
        ]
    },
    {
        version: "v2.1",
        date: "2026-02-16",
        title: "平行宇宙与混合截断 (Multiverse Update)",
        changes: [
            "✨ [重构] 会话隔离：不同窗口可独立保存 API Key、模型与人设",
            "💰 [核心] 混合截断算法 (Hybrid Truncation)：双重限制 (10条/2000字)，严格控制 Claude 成本",
            "🛠️ [优化] 实现了 DeepSeek (廉价区) 与 Claude (贵族区) 的无缝切换"
        ]
    },
    {
        version: "v1.6",
        date: "2026-02-16",
        title: "Claude 兼容性修复 (The Claude Fix)",
        changes: [
            "🐛 [修复] 重写流式解析器 (Stream Parser)，完美兼容 Claude 3.5 Sonnet 格式",
            "🛠️ [调试] 解决了 OpenRouter 402 Payment 误报问题 (Limit 设置)",
            "✨ [优化] 增加了调试模式的控制台日志输出"
        ]
    },
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