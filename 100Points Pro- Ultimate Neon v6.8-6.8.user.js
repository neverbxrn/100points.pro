// ==UserScript==
// @name         100Points Pro: Ultimate Neon v6.8
// @namespace    http://tampermonkey.net/
// @version      6.8
// @description  Тот самый визуал + Пост-процессинг прогресс-бара + Умный фильтр
// @author       bebebebebe
// @match        https://lk.100points.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.100points.ru
// @run-at       document-start
// @require https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    const cache = {
        data: JSON.parse(localStorage.getItem('pts_pro_cache_v2') || '{}'),
        get(id) { return this.data[id]; },
        set(id, val) {
            this.data[id] = val;
            localStorage.setItem('pts_pro_cache_v2', JSON.stringify(this.data));
        }
    };

    let authToken = null;
    let retryCount = new Map();
    let lastUrl = location.href;

    let settings = JSON.parse(localStorage.getItem('100pts_settings')) || {
        cardStyle: 'default',
        badgeStyle: 'flat', // Для плашки
        barStyle: 'default',
        fontStyle: 'default',
        fontSize: 14,
        cardPadding: 100,
        showCaptureBtn: true, // Одиночная кнопка
        showMassCaptureBtn: true, // Кнопка "Скачать всё"
        videoResizer: true,
        showChatCloseBtn: true
    };

    const badgeStyles = [
        { id: 'flat', name: 'Стандартный' },
        { id: 'outline', name: 'Контурный неон' },
        { id: 'glass', name: 'Стеклянный' },
        { id: 'cyber', name: 'Киберпанк' },
        { id: 'minimal', name: 'Минимализм' }
    ];

    const cardStyles = [
        { id: 'default', name: 'Стандартная' },
        { id: 'neon-border', name: 'Контурный неон' },
        { id: 'glass-card', name: 'Стеклянная' },
        { id: 'cyber-card', name: 'Киберпанк (Светлый)' },
        { id: 'minimal-card', name: 'Тонкий акцент' },
        // --- НОВЫЕ 10 СТИЛЕЙ ---
        { id: 'soft-ocean', name: 'Мягкий океан' },
        { id: 'paper-sheet', name: 'Лист бумаги' },
        { id: 'gradient-glow', name: 'Градиентное сияние' },
        { id: 'shadow-depth', name: 'Глубокая тень' },
        { id: 'brutalist', name: 'Брутализм' },
        { id: 'dot-grid', name: 'Точечная сетка' },
        { id: 'rainbow-edge', name: 'Радужная грань' },
        { id: 'neo-retro', name: 'Нео-ретро' },
        { id: 'frosted-mint', name: 'Морозная мята' },
        { id: 'gold-leaf', name: 'Золотая кайма' },
        { id: 'soft-clay', name: 'Мягкая глина (Neumorphism)' },
{ id: 'aqua-glass', name: 'Морское стекло' },
{ id: 'ceramic-white', name: 'Белая керамика' },
{ id: 'blueprint', name: 'Чертеж' },
{ id: 'industrial-mesh', name: 'Промышленная сетка' },
{ id: 'pulp-fiction', name: 'Газетная вырезка' },
{ id: 'sweet-marshmallow', name: 'Зефирный градиент' },
{ id: 'stamped-card', name: 'Штампованный картон' },
{ id: 'modern-sketch', name: 'Эскиз карандашом' },
{ id: 'iridescent-pearl', name: 'Жемчужный блеск' }
    ];

    const hoverAnimations = [
    { id: 'none', name: 'Нет' },
    { id: 'float', name: 'Всплытие' },
    { id: 'glow', name: 'Сияние' },
    { id: 'scale', name: 'Увеличение' },
    { id: 'tilt', name: 'Наклон' },
    { id: 'shake', name: 'Пульсация' },
    { id: 'glass', name: 'Блеск' },
    { id: 'border-flow', name: 'Поток границ' },
    { id: 'shadow-deep', name: 'Глубокая тень' },
    { id: 'flip-lite', name: 'Микро-разворот' },
    { id: 'inner-glow', name: 'Внутреннее свечение' },
    { id: 'bounce', name: 'Прыжок' },
    { id: 'focus', name: 'Фокус (блюр других)' },
    { id: 'rainbow', name: 'Радуга' },
    { id: 'press', name: 'Нажатие' },
    { id: 'accent', name: 'Заливка цветом' }
];

    const saveSettings = () => localStorage.setItem('100pts_settings', JSON.stringify(settings));

    // --- ПЕРЕХВАТ ТОКЕНА ДЛЯ РАБОТЫ ФИКСОВ ---
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'authorization' && value.includes('Bearer')) {
            authToken = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };

    // --- ПОЛНЫЙ ВИЗУАЛЬНЫЙ ПАКЕТ (СТИЛИ 6.2 + ПОСТ-ПРОЦЕССИНГ БАР) ---
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@700&family=Montserrat:wght@700;900&family=Oswald:wght@500&family=Pacifico&family=Playfair+Display:wght@700&family=Raleway:wght@700&family=Roboto:wght@400;700&family=Ubuntu:wght@500&family=Unbounded:wght@700&display=swap');

        /* КАРТОЧКИ КУРСОВ И УРОКОВ */

        /* Основной контейнер карточки */
/* Базовые стили для активации анимаций */
.mUkKn, .UAktb {
    --card-color: #775AFA; /* Цвет по умолчанию */
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
    position: relative !important;
}

/* Фикс для того, чтобы анимации не обрезались */
.UAktb { overflow: visible !important; }

/* Твои анимации (пример одной, убедись что у остальных есть !important) */
.hover-float:hover {
    transform: translateY(-10px) !important;
    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
}

/* Специфичный стиль для режима Focus (блюр соседей) */
body:has(.hover-focus:hover) .mUkKn:not(:hover),
body:has(.hover-focus:hover) .UAktb:not(:hover) {
    filter: blur(2px) grayscale(0.5) !important;
    opacity: 0.6 !important;
}

.UAktb:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(119, 90, 250, 0.15) !important;
    border-color: rgba(119, 90, 250, 0.4) !important;
}

/* Обложка курса */
.pXp72 {
    border-radius: 0 0 20px 20px !important;
    position: relative;
    overflow: hidden;
}

/* Название курса на обложке */
.TOeQk {
    background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%) !important;
    padding: 20px 15px !important;
    height: auto !important;
    display: flex !important;
    align-items: flex-end !important;
}

.TOeQk p {
    color: white !important;
    font-weight: 800 !important;
    font-size: 1.1em !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

/* Прогресс-бар (Неоновый стиль) */
.DG6Jl {
    height: 8px !important;
    background: #f0f0f0 !important;
    border-radius: 10px !important;
    overflow: visible !important; /* Для свечения */
    margin-top: 10px !important;
}

.NUfp2 {
    border-radius: 10px !important;
    background: linear-gradient(90deg, #775AFA, #5C8AFF) !important;
    box-shadow: 0 0 10px rgba(119, 90, 250, 0.6) !important;
    position: relative;
}

/* Текст "Пройдено 81%" */
.ZP0bu {
    font-weight: bold !important;
    color: #444 !important;
}

.ZP0bu span:last-child {
    background: #775AFA;
    color: white;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.9em;
}

/* Нижняя кнопка перехода к уроку */
.yOmZn {
    background: rgba(119, 90, 250, 0.05) !important;
    border-top: 1px solid rgba(119, 90, 250, 0.1) !important;
    transition: background 0.3s !important;
}

.yOmZn:hover {
    background: rgba(119, 90, 250, 0.1) !important;
    text-decoration: none !important;
}

.T6RCe {
    font-weight: 600 !important;
    color: #555 !important;
}

        .mUkKn { position: relative !important; border: 2px solid #eef0f7 !important; border-radius: 20px !important; margin-bottom: 18px !important; padding: 22px !important; background: #ffffff !important; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important; overflow: hidden !important; }
        .mUkKn:hover { border-color: #775AFA !important; transform: translateY(-5px) scale(1.01) !important; box-shadow: 0 12px 30px rgba(119, 90, 250, 0.2) !important; }
        .mUkKn .eBD_9 { padding-right: 80px !important; font-weight: 800 !important; font-size: 1.1em !important; color: #1a1a1a !important; }

        /* Принудительный сброс для дефолтного стиля */
.mUkKn:not(.custom-card-active) {
    clip-path: none !important;
    border-radius: 20px !important; /* Стандарт сайта */
    border: 2px solid #eef0f7 !important;
    box-shadow: none !important;
    background: #ffffff !important;
}

/* Фикс для плавности переключения */
.mUkKn {
    transition: all 0.3s ease, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}

        /* КНОПКИ СТАТУСОВ */
        .Rjxh7 { display: inline-flex !important; padding: 6px 14px !important; border-radius: 12px !important; margin-top: 10px !important; font-weight: 800 !important; color: #fff !important; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .Rjxh7.Plz9L { background: linear-gradient(135deg, #00D05A, #00A347) !important; box-shadow: 0 4px 12px rgba(0, 208, 90, 0.3) !important; }
        .Rjxh7.lDHDR { background: linear-gradient(135deg, #FF4747, #D32F2F) !important; box-shadow: 0 4px 12px rgba(255, 71, 71, 0.3) !important; }
        .status-checking { background: linear-gradient(135deg, #FFD700, #FFA500) !important; color: #000 !important; box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4) !important; }
        .status-checking span { color: #000 !important; }

        /* ДЕДЛАЙНЫ */
.deadline-counter {
    display: block;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #666;
}
.deadline-urgent {
    color: #FF4747 !important;
    animation: deadline-pulse 1.5s infinite;
}
@keyframes deadline-pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
}

/* Анимация пульсации для срочных дедлайнов */
@keyframes deadline-urgent-pulse {
    0% { box-shadow: 0 0 5px #FF4747; opacity: 1; }
    50% { box-shadow: 0 0 20px #FF4747; opacity: 0.8; }
    100% { box-shadow: 0 0 5px #FF4747; opacity: 1; }
}
.deadline-urgent {
    animation: deadline-urgent-pulse 1.5s infinite ease-in-out !important;
}

@keyframes badge-fade-in {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

.custom-percent-badge {
    /* Добавь эти свойства к существующему классу */
    animation: badge-fade-in 0.4s ease-out forwards;
    display: none; /* По умолчанию скрыта */
}

        /* ПОСТ-ПРОЦЕССИНГ ПРОГРЕСС-БАРА */
        .HF6wH { background: rgba(0, 0, 0, 0.05) !important; height: 10px !important; border-radius: 12px !important; margin-top: 18px !important; overflow: visible !important; position: relative; border: 1px solid rgba(0,0,0,0.03); }
        .D0VIa {
            height: 100% !important; border-radius: 12px !important; position: relative;
            transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease !important;
            box-shadow: 0 0 8px currentColor, 0 0 20px currentColor, 0 0 35px rgba(currentColor, 0.4) !important;
        }
        .D0VIa::after {
            content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(to bottom, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.08) 100%);
            border-radius: 12px; box-shadow: inset 0 1px 1px rgba(255,255,255,0.4);
        }
        .D0VIa::before {
            content: ""; position: absolute; top: 15%; left: 2%; right: 2%; bottom: 55%;
            background: rgba(255, 255, 255, 0.35); border-radius: 10px; filter: blur(1px); z-index: 1;
        }

        /* ПРОЦЕНТЫ И ТЕМНАЯ ТЕМА */
        .custom-percent-badge { position: absolute !important; top: 20px !important; right: 20px !important; background: #775AFA !important; color: #fff !important; padding: 5px 12px !important; border-radius: 12px !important; font-size: 12px !important; font-weight: 900 !important; box-shadow: 0 4px 10px rgba(119, 90, 250, 0.3) !important; }
        body.is-dark-mode .UAktb { background: #1a1a2e !important; border-color: #8b72ff !important; box-shadow: 0 15px 40px rgba(0,0,0,0.5) !important; }
        body.is-dark-mode .mUkKn { background: #252545 !important; border-color: #35355a !important; }
        body.is-dark-mode .mUkKn .eBD_9 { color: #fff !important; }
        body.is-dark-mode .HF6wH { background: rgba(255, 255, 255, 0.08) !important; border-color: rgba(255,255,255,0.1); }

        /* ПЛАВАЮЩАЯ КНОПКА (FIXED) */
        .points-settings-btn {
            position: fixed !important; bottom: 30px !important; right: 30px !important;
            width: 55px !important; height: 55px !important; background: #775AFA !important;
            border: 3px solid #fff !important; border-radius: 50% !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
            cursor: pointer !important; z-index: 2147483647 !important;
            box-shadow: 0 5px 20px rgba(119, 90, 250, 0.6) !important; color: white !important; font-size: 28px !important;
            transition: transform 0.3s ease !important;
        }
        .points-settings-btn:hover { transform: scale(1.1) rotate(45deg) !important; }

        /* БОКОВОЕ МЕНЮ */
        #pts-menu {
            position: fixed; top: 0; right: -350px; width: 300px; height: 100%;
            background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(10px);
            box-shadow: -5px 0 25px rgba(0,0,0,0.1); z-index: 2147483646;
            transition: right 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); padding: 25px; overflow-y: auto;
        }
        #pts-menu.open { right: 0; }
        #pts-menu h2 { color: #775AFA; margin: 0 0 20px 0; font-size: 20px; font-weight: 800; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .menu-section { margin-bottom: 25px; }
        .menu-section h3 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }

        /* ВАРИАНТЫ ВЫБОРА */
        .style-option {
            padding: 12px; border: 2px solid #eee; border-radius: 14px; margin-bottom: 10px;
            cursor: pointer; transition: all 0.2s ease; background: white; font-weight: 600; font-size: 14px; color: #333;
        }
        .style-option:hover { border-color: #775AFA; transform: translateX(-5px); }
        .style-option.active { border-color: #775AFA; background: #f8f7ff; color: #775AFA; }

        /* Стилизация выпадающих списков */
        .pts-select {
            width: 100%;
            padding: 10px;
            border-radius: 10px;
            border: 2px solid #eee;
            background: #fff;
            font-size: 14px;
            font-weight: 600;
            color: #333;
            outline: none;
            cursor: pointer;
            transition: border-color 0.2s;
        }
        .pts-select:focus { border-color: #775AFA; }

        .pts-range {
            width: 100%;
            accent-color: #775AFA;
            cursor: pointer;
        }
        .menu-section label {
            display: block;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 5px;
            color: #555;
        }

        /* Классы для шрифтов */
        .font-montserrat { font-family: 'Montserrat', sans-serif !important; }
        .font-inter { font-family: 'Inter', sans-serif !important; }
        .font-mono { font-family: 'JetBrains Mono', monospace !important; }

        /* Анимация плавного появления */
@keyframes badge-appearance {
    from { opacity: 0; transform: scale(0.8) translateY(5px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.custom-percent-badge {
    position: absolute;
    right: 10px;
    top: 10px;
    padding: 4px 10px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    color: white;
    z-index: 20;
    transition: all 0.3s ease;
    animation: badge-appearance 0.5s ease-out forwards;
}

/* --- СТИЛИ КАРТОЧЕК (ТЕПЕРЬ БЕЛЫЕ) --- */
.style-neon-border {
    border: 2px solid var(--card-color) !important;
    box-shadow: 0 0 15px var(--card-color) !important;
    background: #ffffff !important; /* Возвращен белый */
}

.style-glass-card {
    background: rgba(255, 255, 255, 0.7) !important; /* Светлое стекло */
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.5) !important;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1) !important;
}

.style-cyber-card {
    background: #ffffff !important;
    border: 1px solid var(--card-color) !important;
    clip-path: polygon(0 0, 100% 0, 100% 90%, 95% 100%, 0 100%);
    border-left: 5px solid var(--card-color) !important;
}

.style-minimal-card {
    background: #ffffff !important;
    border: none !important;
    border-bottom: 4px solid var(--card-color) !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
}

/* Базовый класс для кастомных карточек */
.custom-card-active {
    transition: all 0.3s ease !important;
}

/* 1. Мягкий океан */
.style-soft-ocean {
    background: linear-gradient(135deg, #e0f2f1 0%, #ffffff 100%) !important;
    border-left: 5px solid #00acc1 !important;
}

/* 2. Лист бумаги */
.style-paper-sheet {
    background: #fdfdfd !important;
    border: 1px solid #ddd !important;
    box-shadow: 2px 2px 0px rgba(0,0,0,0.05) !important;
    border-radius: 2px !important;
}

/* 3. Градиентное сияние */
.style-gradient-glow {
    border: 2px solid transparent !important;
    background: linear-gradient(white, white) padding-box,
                linear-gradient(45deg, var(--card-color), #ff0080) border-box !important;
}

/* 4. Глубокая тень */
.style-shadow-depth {
    box-shadow: 0 10px 20px rgba(0,0,0,0.1), 0 6px 6px rgba(0,0,0,0.1) !important;
    border: none !important;
}

/* 5. Брутализм */
.style-brutalist {
    border: 3px solid #000 !important;
    box-shadow: 5px 5px 0px #000 !important;
    border-radius: 0 !important;
}

/* 6. Точечная сетка */
.style-dot-grid {
    background-color: #fff !important;
    background-image: radial-gradient(#d7d7d7 1px, transparent 1px) !important;
    background-size: 10px 10px !important;
}

/* 7. Радужная грань */
.style-rainbow-edge {
    border-bottom: 4px solid transparent !important;
    border-image: linear-gradient(90deg, red, orange, yellow, green, blue, purple) 1 !important;
}

/* 8. Нео-ретро */
.style-neo-retro {
    background: #222 !important;
    border: 2px solid #0ff !important;
    color: #0ff !important;
}

/* 9. Морозная мята */
.style-frosted-mint {
    background: rgba(224, 255, 241, 0.8) !important;
    backdrop-filter: blur(5px);
    border: 1px solid #b2dfdb !important;
}

/* 10. Золотая кайма */
.style-gold-leaf {
    border: 1px solid #d4af37 !important;
    box-shadow: inset 0 0 5px #d4af37 !important;
    background: #fffaf0 !important;
}

/* 11. Мягкая глина (Светлый неоморфизм) */
.style-soft-clay {
    background: #f0f0f3 !important;
    box-shadow: 7px 7px 15px #d1d9e6, -7px -7px 15px #ffffff !important;
    border: none !important;
}

/* 12. Морское стекло (Голубоватый полупрозрачный) */
.style-aqua-glass {
    background: rgba(224, 247, 250, 0.6) !important;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 188, 212, 0.2) !important;
    box-shadow: 0 4px 15px rgba(0, 188, 212, 0.1) !important;
}

/* 13. Белая керамика (Глянцевый белый с тонким бликом) */
.style-ceramic-white {
    background: #fff !important;
    border: 1px solid #eee !important;
    background-image: linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 70%) !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
}

/* 14. Чертеж (Синие линии на белом) */
.style-blueprint {
    background-color: #ffffff !important;
    background-image: linear-gradient(rgba(119, 90, 250, 0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(119, 90, 250, 0.05) 1px, transparent 1px) !important;
    background-size: 20px 20px !important;
    border: 1px solid rgba(119, 90, 250, 0.2) !important;
}

/* 15. Промышленная сетка (Мелкий ромб) */
.style-industrial-mesh {
    background: #f8f9fa !important;
    background-image: url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='M5 0h1L0 6V5zM6 5v1H5z'/%3E%3C/g%3E%3C/svg%3E") !important;
    border: 1px solid #dee2e6 !important;
}

/* 16. Газетная вырезка (Желтоватая бумага и грубая рамка) */
.style-pulp-fiction {
    background: #fdf6e3 !important;
    border: 1px solid #d3c6aa !important;
    font-family: serif !important;
    box-shadow: 3px 3px 0px rgba(0,0,0,0.1) !important;
}

/* 17. Зефирный градиент (Очень мягкий пастельный) */
.style-sweet-marshmallow {
    background: linear-gradient(135deg, #fff5f5 0%, #f0f4ff 100%) !important;
    border: 1px solid #ffd1d1 !important;
}

/* 18. Штампованный картон */
.style-stamped-card {
    background: #f4f1ea !important;
    border: 2px dashed #c4b9a3 !important;
    border-radius: 8px !important;
}

/* 19. Эскиз карандашом (Штриховка по краям) */
.style-modern-sketch {
    background: #fff !important;
    border: 2px solid #333 !important;
    border-radius: 255px 15px 225px 15px/15px 225px 15px 255px !important; /* Кривая рамка от руки */
}

/* 20. Жемчужный блеск (Перламутр) */
.style-iridescent-pearl {
    background: linear-gradient(45deg, #ffffff 0%, #f2f2f2 45%, #e6e6e6 55%, #ffffff 100%) !important;
    border: 1px solid rgba(255,255,255,0.5) !important;
    box-shadow: 0 0 10px rgba(255,255,255,0.8), inset 0 0 10px rgba(0,0,0,0.02) !important;
}

/* --- СТИЛИ ПЛАШЕК (ПРОЦЕНТОВ) --- */
.badge-outline {
    background: #ffffff !important;
    border: 2px solid var(--card-color) !important;
    color: var(--card-color) !important;
    box-shadow: 0 0 8px var(--card-color) !important;
}

.badge-glass {
    background: rgba(255, 255, 255, 0.4) !important;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    color: #333 !important;
}

.badge-cyber {
    background: var(--card-color) !important;
    color: white !important;
    clip-path: polygon(10% 0, 100% 0, 90% 100%, 0 100%);
}

.badge-minimal {
    background: #f0f0f0 !important;
    border-left: 4px solid var(--card-color) !important;
    color: #333 !important;
}

/* Базовый видимый слой для всех плашек */
.custom-percent-badge {
    display: none;
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 12px;
    z-index: 10;
    color: white; /* Цвет текста по умолчанию */
    min-width: 40px;
    text-align: center;
}

/* Белый фон для контурных стилей, чтобы они не были прозрачными на белом */
.badge-outline, .badge-glass {
    background: #ffffff !important;
    color: var(--badge-color, #333) !important;
}

/* --- АНИМАЦИИ ПРИ НАВЕДЕНИИ --- */

/* 1. Всплытие */
.hover-float:hover {
    transform: translateY(-10px) !important;
    box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important;
}

/* 2. Сияние (Neon Glow) */
.hover-glow:hover {
    box-shadow: 0 0 20px var(--card-color) !important;
    border-color: var(--card-color) !important;
}

/* 3. Увеличение */
.hover-scale:hover {
    transform: scale(1.03) !important;
    z-index: 5;
}

/* 4. Наклон */
.hover-tilt:hover {
    transform: perspective(1000px) rotateX(5deg) rotateY(2deg) !important;
}

/* 5. Пульсация */
@keyframes hover-shake-anim {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}
.hover-shake:hover {
    animation: hover-shake-anim 0.6s infinite ease-in-out !important;
}

/* 6. Стеклянный блеск (Blink) */
.hover-glass { position: relative; overflow: hidden; }
.hover-glass::after {
    content: ""; position: absolute; top: -50%; left: -60%; width: 20%; height: 200%;
    background: rgba(255, 255, 255, 0.4); transform: rotate(30deg);
    transition: none; opacity: 0;
}
.hover-glass:hover::after {
    left: 120%; transition: all 0.6s ease-in-out; opacity: 1;
}

/* 7. Рамка-градиент */
.hover-border-flow:hover {
    border-color: transparent !important;
    background-image: linear-gradient(#fff, #fff), linear-gradient(90deg, var(--card-color), #5C8AFF);
    background-origin: border-box; background-clip: content-box, border-box;
    border: 2px solid transparent !important;
}

/* 8. Тень под карточкой (Lift) */
.hover-shadow-deep:hover {
    transform: translateY(-5px) !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
}

/* 9. Разворот (Flip-lite) */
.hover-flip-lite:hover {
    transform: rotateY(10deg) rotateX(2deg) !important;
}

/* 10. Внутреннее свечение (Inner Glow) */
.hover-inner-glow:hover {
    box-shadow: inset 0 0 15px var(--card-color) !important;
}

/* 11. Прыжок (Bounce) */
@keyframes bounce-anim {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-7px); }
}
.hover-bounce:hover { animation: bounce-anim 0.6s infinite !important; }

/* 12. Размытие фона (Focus) */
.hover-focus:hover { transform: scale(1.02) !important; }
body:has(.hover-focus:hover) .mUkKn:not(:hover),
body:has(.hover-focus:hover) .UAktb:not(:hover) {
    filter: blur(2px) grayscale(0.5); opacity: 0.8;
}

/* 13. Радужный неон */
@keyframes rainbow-border {
    0% { border-color: #ff0000; } 33% { border-color: #00ff00; } 66% { border-color: #0000ff; } 100% { border-color: #ff0000; }
}
.hover-rainbow:hover { animation: rainbow-border 2s infinite linear !important; border-width: 2px !important; }

/* 14. Сжатие (Press) */
.hover-press:hover { transform: scale(0.97) !important; filter: brightness(0.9); }

/* 15. Цветной акцент */
.hover-accent:hover {
    background: var(--card-color) !important;
}
.hover-accent:hover * { color: white !important; }

/* Плавность для всех карточек */
.mUkKn {
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
}

/* Квадратная кнопка скачивания */
.download-task-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    width: 36px; /* Одинаковая ширина и высота */
    height: 36px;
    padding: 0;
    background: #775AFA;
    color: white !important;
    border: none;
    border-radius: 8px; /* Слегка скругленный квадрат */
    cursor: pointer;
    font-size: 18px; /* Размер иконки */
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.1; /* Едва заметна в покое */
    transition: all 0.2s ease;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.dJ46J:hover .download-task-btn {
    opacity: 1;
}

.download-task-btn:hover {
    background: #6246e5;
    transform: scale(1.1);
}

/* Убираем "Уровень ЕГЭ" и лишние иконки рядом с ним */
.dUBAa.w0zSk {
    display: none !important;
}

/* Фикс для буфера: уведомление о копировании */
.copy-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #00D05A;
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-weight: bold;
    z-index: 10000;
    animation: fade-in-out 2s forwards;
}

@keyframes fade-in-out {
    0% { opacity: 0; transform: translate(-50%, 20px); }
    20% { opacity: 1; transform: translate(-50%, 0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
}

/* Фиксируем контекст, чтобы кнопка не улетала */
.dJ46J {
    position: relative !important;
}

/* Квадратная кнопка в углу контейнера */
.download-task-btn {
    position: absolute !important;
    top: 10px !important;
    right: 10px !important;
    width: 36px !important;
    height: 36px !important;
    z-index: 9999 !important; /* Поверх всего внутри задачи */
    padding: 0 !important;
    background: #775AFA !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    font-size: 18px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    opacity: 0.1;
    transition: all 0.2s ease;
}

/* Показываем только при наведении на саму задачу */
.dJ46J:hover .download-task-btn {
    opacity: 1;
}

.download-all-tasks-btn {
    margin-left: 10px;
    padding: 5px 15px;
    background: #00D05A;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    font-size: 12px;
    transition: all 0.2s;
}
.download-all-tasks-btn:hover { background: #00b34d; transform: scale(1.05); }
.download-all-tasks-btn:disabled { background: #ccc; cursor: not-allowed; }

/* Скрытие через классы управления */
.hide-capture-btns .download-task-btn { display: none !important; }
.hide-mass-capture .download-all-tasks-btn { display: none !important; }

/* Стили для чекбоксов в меню */
.menu-checkbox-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}
.pts-checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: #775AFA;
}

/* Контейнер видео */
.gDPOa {
    position: relative !important; /* КРИТИЧНО для уголка */
    flex-shrink: 0 !important;
    margin-right: 15px !important;
    border: 1px solid transparent;
}

/* Контейнер-обертка для видео и чата */
.wCNrd {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: flex-start !important;
    width: 100% !important;
    max-width: none !important;
}

/* Кнопка закрытия чата */
.chat-close-btn {
    position: absolute !important;
    top: -30px !important; /* Над чатом */
    right: 0 !important;
    background: #775AFA !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
    padding: 2px 8px !important;
    cursor: pointer !important;
    font-size: 11px !important;
    z-index: 100 !important;
    opacity: 0.5;
    transition: opacity 0.2s;
}

.chat-close-btn:hover {
    opacity: 1;
    background: #5a42cc !important;
}

/* Контейнер чата должен быть relative, чтобы кнопка позиционировалась от него */
.vqMgR {
    position: relative !important;
    display: block !important;
}

/* Класс для скрытия чата */
.chat-hidden {
    display: none !important;
}

/* Если чат скрыт, убираем отступ у видео */
.chat-hidden + .gDPOa, .gDPOa:has(+ .chat-hidden) {
    margin-right: 0 !important;
}

/* Уголок */
.video-resizer-handle {
    position: absolute !important;
    right: 5px !important;  /* Чуть отодвинул от самого края */
    bottom: 5px !important;
    width: 20px !important;
    height: 20px !important;
    background: linear-gradient(135deg, transparent 50%, #775AFA 50%) !important;
    cursor: nwse-resize !important;
    z-index: 2147483647 !important;
    border-radius: 2px !important;
    display: block !important; /* Гарантируем видимость */
    box-shadow: -1px -1px 2px rgba(0,0,0,0.2);
}

/* Снятие лимитов с родителей */
.force-resizable-limit {
    max-width: none !important;
    width: fit-content !important;
}

/* Контейнеры для лоадеров */
svg.Z9K3I, .ormof {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    width: 150px !important; /* Увеличили, чтобы влезла надпись */
    height: 180px !important;
    background-image: url('https://i.giphy.com/KbdF8DCgaoIVC8BHTK.webp') !important; /* Pop Cat (более надежная ссылка) */
    background-size: 100px 100px !important;
    background-position: top center !important;
    background-repeat: no-repeat !important;
    background-color: transparent !important;
    border: none !important;
    position: relative !important;
    margin: 20px auto !important;
    overflow: visible !important;
}

/* Скрываем старый контент */
svg.Z9K3I *, .ormof * {
    display: none !important;
}

/* Добавляем надпись "грузится, пагоди" */
svg.Z9K3I::after, .ormof::after {
    content: "грузится, пагоди..." !important;
    display: block !important;
    position: absolute !important;
    bottom: 10px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: max-content !important;

    /* Стили текста */
    font-family: 'Inter', 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    color: var(--card-color, #775AFA) !important;
    text-transform: lowercase !important;
    letter-spacing: 0.5px !important;

    /* Анимация мигания */
    animation: loading-text-pulse 1.5s infinite ease-in-out !important;
}

/* Сама анимация текста */
@keyframes loading-text-pulse {
    0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(0.95); }
    50% { opacity: 1; transform: translateX(-50%) scale(1); }
}

/* Добавляем мягкое свечение вокруг котика, если включен неон */
body[data-theme="dark"] svg.Z9K3I {
    filter: drop-shadow(0 0 10px rgba(119, 90, 250, 0.5)) !important;
}
    `);

    function updateThemeClass() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark';
        document.body.classList.toggle('is-dark-mode', isDark);
    }

    function applyStatusToDOM(status, badge, lessonNode, deadline = null) {
        const span = badge.querySelector('span');
        if (!span) return;

        // СОХРАНЯЕМ ТВОИ ФИКСЫ БАГОВ
        if (status === 'passed') {
            badge.className = 'Rjxh7 Plz9L';
            span.innerText = 'Пройдено (fix)';
        } else if (status === 'checking') {
            badge.className = 'Rjxh7 status-checking';
            span.innerText = 'На проверке';
        } else if (status === 'failed') {
            badge.className = 'Rjxh7 lDHDR';
            // Если API вернуло дедлайн, пишем его, чтобы processVisuals подхватил
            if (deadline) {
                const d = new Date(deadline);
                const dateStr = d.toLocaleDateString('ru-RU');
                span.innerText = `Срок сдачи до ${dateStr} 23:59`;
            } else {
                span.innerText = 'Срок сдачи';
            }
        }

        // ПРИНУДИТЕЛЬНО ОБНОВЛЯЕМ ВИЗУАЛ (чтобы плашка увидела новый текст)
        processVisuals(lessonNode);
    }

    function fetchRealStatus(lessonId, badge, lessonNode) {
        let attempts = retryCount.get(lessonId) || 0;
        if (attempts >= 3) return;
        retryCount.set(lessonId, attempts + 1);

        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.100points.ru/api/student/lessons/${lessonId}/personal`,
            headers: { "Authorization": authToken, "Accept": "application/json" },
            onload: function(res) {
                try {
                    const data = JSON.parse(res.responseText);
                    const hw = data.homeworks?.difficulties?.[0] || data.homeworks || {};

                    const status = hw.student_status || data.student_status;
                    const deadline = hw.deadline || data.deadline;
                    const isPassed = hw.is_deadline_passed !== undefined ? hw.is_deadline_passed : data.is_deadline_passed;

                    // Сохраняем в долгосрочный кэш
                    cache.set(lessonId, { status, deadline, is_deadline_passed: isPassed });

                    // Применяем статус
                    applyStatusToDOM(status, badge, lessonNode, deadline);

                    // Если статус финальный, блокируем повторные проверки
                    if (status === 'passed') {
                        badge.setAttribute('data-checked', 'true');
                    }
                } catch (e) {}
            }
        });
    }

    function updateDynamicStyles() {
        const old = document.getElementById('pts-dynamic-css');
        if (old) old.remove();

        let css = '';
        const cardScale = (settings.cardPadding || 100) / 100;

        // --- 1. МАСШТАБ И ШРИФТЫ ---
        css += `
        .mUkKn {
            zoom: ${cardScale} !important;
            transform-origin: top center !important;
        }
        .mUkKn, .mUkKn * {
            font-size: ${settings.fontSize}px !important;
        }
    `;

        if (settings.fontStyle && settings.fontStyle !== 'default') {
            css += `.mUkKn, .mUkKn div, .mUkKn span, .mUkKn a, .mUkKn h1, .mUkKn h2, .mUkKn h3, .mUkKn p, .mUkKn button { font-family: '${settings.fontStyle}', sans-serif !important; }`;
        }

        // --- 2. ЭФФЕКТ BLOOM (НЕОН) ---
        // Если выбран стандартный неоновый бар, добавляем ему многослойное свечение
        if (settings.barStyle === 'default') {
            css += `
            .D0VIa {
                position: relative !important;
                /* Эффект Bloom через множественные тени */
                box-shadow: 0 0 5px currentColor,
                            0 0 10px currentColor,
                            0 0 20px currentColor !important;
                transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease !important;
            }
            /* Дополнительный яркий блик внутри для объема */
            .D0VIa::after {
                content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent, rgba(0,0,0,0.1));
                border-radius: inherit;
            }
        `;
        }

        // --- 3. ОСТАЛЬНЫЕ СТИЛИ (Liquid, Glass и т.д.) ---
        if (settings.barStyle === 'liquid') {
            css += `
            .D0VIa::before, .D0VIa::after { display: none !important; }
            .D0VIa {
                background-image: linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.25) 75%, transparent 75%, transparent) !important;
                background-size: 40px 40px !important;
                animation: pts-bar-move 2s linear infinite !important;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1) !important;
            }
        `;
        }

        // Стили карточек
        if (settings.lessonStyle === 'glass') {
            css += `.mUkKn { background: rgba(255, 255, 255, 0.4) !important; backdrop-filter: blur(12px) !important; border: 1px solid rgba(119, 90, 250, 0.3) !important; }`;
        } else if (settings.lessonStyle === 'soft') {
            css += `.mUkKn { border: none !important; background: #f0f2ff !important; box-shadow: 8px 8px 15px #d1d9e6, -8px -8px 15px #ffffff !important; }`;
        }

        css += `@keyframes pts-bar-move { from { background-position: 0 0; } to { background-position: 40px 0; } }`;

        const styleNode = document.createElement('style');
        styleNode.id = 'pts-dynamic-css';
        styleNode.innerHTML = css;
        document.head.appendChild(styleNode);
    }

    function createMenu() {
        if (document.querySelector('.points-settings-btn')) return;

        const btn = document.createElement('div');
        btn.className = 'points-settings-btn';
        btn.innerHTML = '⚙';
        document.body.appendChild(btn);

        const menu = document.createElement('div');
        menu.id = 'pts-menu';
        menu.innerHTML = `
            <h2 style="margin-bottom: 15px;">100Points Pro</h2>

            <div class="menu-section">
                <label>Стиль карточек</label>
                <select class="pts-select" data-setting="cardStyle">
                    ${cardStyles.map(s => `<option value="${s.id}" ${settings.cardStyle === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>

            <div class="menu-section">
                <label>Стиль плашки (процентов)</label>
                <select class="pts-select" data-setting="badgeStyle">
                    ${badgeStyles.map(s => `<option value="${s.id}" ${settings.badgeStyle === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>

            <div class="menu-section">
                <label>Анимация при наведении</label>
                <select class="pts-select" data-setting="hoverAnim">
                    ${hoverAnimations.map(a => `<option value="${a.id}" ${settings.hoverAnim === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                </select>
            </div>

            <div class="menu-section">
                <label>Тип прогресс-бара</label>
                <select class="pts-select" data-setting="barStyle">
                    <option value="default" ${settings.barStyle === 'default' ? 'selected' : ''}>Неоновый</option>
                    <option value="dynamic" ${settings.barStyle === 'dynamic' ? 'selected' : ''}>Умный градиент</option>
                    <option value="liquid" ${settings.barStyle === 'liquid' ? 'selected' : ''}>Жидкий</option>
                    <option value="striped" ${settings.barStyle === 'striped' ? 'selected' : ''}>Полосатый</option>
                </select>
            </div>

            <div class="menu-section">
                <label>Шрифт заголовков</label>
                <select class="pts-select" data-setting="fontStyle">
                    <option value="default" ${settings.fontStyle === 'default' ? 'selected' : ''}>Системный</option>
                    <option value="Montserrat" ${settings.fontStyle === 'Montserrat' ? 'selected' : ''}>Montserrat</option>
                    <option value="Inter" ${settings.fontStyle === 'Inter' ? 'selected' : ''}>Inter</option>
                    <option value="Unbounded" ${settings.fontStyle === 'Unbounded' ? 'selected' : ''}>Unbounded</option>
                    <option value="JetBrains Mono" ${settings.fontStyle === 'JetBrains Mono' ? 'selected' : ''}>JetBrains Mono</option>
                    <option value="Oswald" ${settings.fontStyle === 'Oswald' ? 'selected' : ''}>Oswald</option>
                </select>
            </div>

            <hr style="margin: 15px 0; border: 0; border-top: 1px solid #eee;">

            <div class="menu-section">
                <label>Масштаб карточек: <span id="card-val">${settings.cardPadding}</span>%</label>
                <input type="range" class="pts-range" data-setting="cardPadding" min="70" max="130" value="${settings.cardPadding}">
            </div>

            <div class="menu-section">
                <label>Размер текста: <span id="font-val">${settings.fontSize}</span>px</label>
                <input type="range" class="pts-range" data-setting="fontSize" min="10" max="24" value="${settings.fontSize}">
            </div>

            <div class="menu-section">
                <div class="menu-checkbox-section">
                    <label>Ресайз видео (тяни за угол)</label>
                    <input type="checkbox" class="pts-checkbox" data-setting="videoResizer" ${settings.videoResizer ? 'checked' : ''}>
                </div>
            </div>

            <div class="menu-section">
                <div class="menu-checkbox-section">
                    <label>Кнопка захвата задачи (📸)</label>
                    <input type="checkbox" class="pts-checkbox" data-setting="showCaptureBtn" ${settings.showCaptureBtn ? 'checked' : ''}>
                </div>
                <div class="menu-checkbox-section">
                    <label>Кнопка "Скачать всё" (📥)</label>
                    <input type="checkbox" class="pts-checkbox" data-setting="showMassCaptureBtn" ${settings.showMassCaptureBtn ? 'checked' : ''}>
                </div>
            </div>

            <div class="menu-section">
                 <div class="menu-checkbox-section">
                    <label>Кнопка скрытия чата (✕)</label>
                    <input type="checkbox" class="pts-checkbox" data-setting="showChatCloseBtn" ${settings.showChatCloseBtn ? 'checked' : ''}>
                 </div>
            </div>

            <button id="pts-close" style="width: 100%; padding: 12px; background: #775AFA; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; margin-top: 10px;">Готово</button>
        `;
        document.body.appendChild(menu);

        // ЛОГИКА ОТКРЫТИЯ
        btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
        document.getElementById('pts-close').onclick = () => menu.classList.remove('open');

        // ОБРАБОТКА ВСЕХ ИЗМЕНЕНИЙ (oninput для живого отклика)
        menu.querySelectorAll('.pts-select, .pts-range, .pts-checkbox').forEach(el => {
            const updateAll = () => {
                const key = el.dataset.setting;
                let val = el.type === 'checkbox' ? el.checked : el.value;

                if (el.type === 'range') {
                    val = parseInt(val);
                    const labelId = key === 'fontSize' ? 'font-val' : 'card-val';
                    document.getElementById(labelId).innerText = val;
                }

                settings[key] = val;
                saveSettings();

                // Специфическая логика для мгновенного скрытия кнопок
                toggleCaptureVisibility();
                updateChatControl();

                updateDynamicStyles();
                document.querySelectorAll('.mUkKn').forEach(processVisuals);
            };

            el.oninput = updateAll;
            el.onchange = updateAll;
        });
    }

    function toggleCaptureVisibility() {
        // Управляем одиночными кнопками
        document.body.classList.toggle('hide-capture-btns', !settings.showCaptureBtn);

        // Управляем кнопкой массовой загрузки
        document.body.classList.toggle('hide-mass-capture', !settings.showMassCaptureBtn);
    }

    // Вызови её один раз при старте скрипта
    toggleCaptureVisibility();

    function applyCardEffects(element, percent, finalColor) {
    if (!element) return;

    // 1. Управляем СТИЛЕМ (style-...)
    const currentClasses = Array.from(element.classList);
    currentClasses.forEach(cls => {
        // Удаляем старый стиль, только если он отличается от выбранного
        if (cls.startsWith('style-') && cls !== 'style-' + settings.cardStyle) {
            element.classList.remove(cls);
        }
        // Удаляем анимацию, если она сменилась
        if (cls.startsWith('hover-') && cls !== 'hover-' + settings.hoverAnim) {
            element.classList.remove(cls);
        }
    });

    // 2. Устанавливаем цвет (важно для всех стилей)
    element.style.setProperty('--card-color', finalColor);

    // 3. Применяем стиль карточки
    if (settings.cardStyle && settings.cardStyle !== 'default') {
        element.classList.add('custom-card-active');
        element.classList.add('style-' + settings.cardStyle);
    } else {
        element.classList.remove('custom-card-active');
    }

    // 4. Применяем анимацию
    if (settings.hoverAnim && settings.hoverAnim !== 'none') {
        element.classList.add('hover-' + settings.hoverAnim);
    }
}

    function processCourseCard(courseCard) {
        // 1. Ищем процент прохождения курса (в селекторе .ZP0bu)
        const percentSpan = courseCard.querySelector('.ZP0bu span:last-child');
        const p = percentSpan ? parseInt(percentSpan.innerText) : 0;

        // 2. Определяем цвет на основе процента
        let finalColor = (settings.barStyle === 'dynamic')
        ? getSmartColor(p)
        : (p >= 90 ? '#00D05A' : p > 70 ? '#ADFF2F' : p > 30 ? '#FFA500' : '#FF4747');

        // 3. Применяем визуальные эффекты из общей функции
        applyCardEffects(courseCard, p, finalColor);

        // 4. Специфично для курсов: подсвечиваем нативный прогресс-бар курса
        const courseBar = courseCard.querySelector('.NUfp2');
        if (courseBar) {
            courseBar.style.setProperty('background', `linear-gradient(90deg, ${finalColor}, #5C8AFF)`, 'important');
            courseBar.style.setProperty('box-shadow', `0 0 10px ${finalColor}99`, 'important');
        }
    }

    function processVisuals(lesson) {
        const link = lesson.querySelector('a');
        const lessonId = link?.href.match(/lesson\/(\d+)/)?.[1];

        // МГНОВЕННО получаем данные из нашего "вечного" кеша
        const lessonData = cache.get(lessonId);
        const progressBar = lesson.querySelector('.D0VIa');
        const p = progressBar ? (parseInt(progressBar.style.width) || 0) : 0;

        let finalColor = (settings.barStyle === 'dynamic')
        ? getSmartColor(p)
        : (p >= 90 ? '#00D05A' : p > 70 ? '#ADFF2F' : p > 30 ? '#FFA500' : '#FF4747');

        applyCardEffects(lesson, p, finalColor);

        let pbBadge = lesson.querySelector('.custom-percent-badge');
        if (!pbBadge) {
            pbBadge = document.createElement('div');
            pbBadge.className = 'custom-percent-badge';
            lesson.appendChild(pbBadge);
        }

        pbBadge.className = 'custom-percent-badge';
        pbBadge.style.display = 'none';

        let badgeText = '';
        let badgeColor = finalColor;
        let isUrgent = false;

        // --- ПРИОРЕТЕТ ДЕДЛАЙНАМ ---
        // Если есть данные из кеша и урок не пройден полностью
        if (lessonData && p < 100) {
            const { status, deadline, is_deadline_passed } = lessonData;
            if (!is_deadline_passed && deadline && status !== 'passed' && status !== 'checking') {
                const parts = deadline.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                if (parts) {
                    const dDate = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T23:59:59`);
                    const diff = dDate - new Date();
                    if (diff > 0) {
                        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                        badgeText = `${d}д ${h}ч`;
                        badgeColor = (d < 2) ? '#FF4747' : '#775AFA';
                        isUrgent = (d < 2);
                    }
                }
            }
        }

        // Если дедлайна нет или урок уже начат, показываем проценты (если они выше 0)
        if (!badgeText && p > 0) {
            badgeText = p + '%';
            badgeColor = finalColor;
        }

        if (badgeText) {
            pbBadge.innerText = badgeText;
            pbBadge.style.display = 'block';
            pbBadge.style.setProperty('--badge-color', badgeColor);
            if (settings.badgeStyle && settings.badgeStyle !== 'flat') {
                pbBadge.classList.add('badge-' + settings.badgeStyle);
            } else {
                pbBadge.style.background = badgeColor;
            }
            if (isUrgent) pbBadge.classList.add('deadline-urgent');
        }

        if (progressBar) {
            progressBar.style.setProperty('background-color', finalColor, 'important');
            progressBar.style.setProperty('box-shadow', `0 0 10px ${finalColor}`, 'important');
        }
    }

    function processStatusLogic(lesson, badge) {
        const link = lesson.querySelector('a');
        const lessonId = link?.href.match(/lesson\/(\d+)/)?.[1];
        if (!lessonId) return;

        const cached = cache.get(lessonId);

        // 1. ЕСЛИ ПРОЙДЕНО — отрисовываем и забываем навсегда
        if (cached && cached.status === 'passed') {
            if (!badge.hasAttribute('data-checked')) {
                applyStatusToDOM('passed', badge, lesson);
                badge.setAttribute('data-checked', 'true');
            }
            return;
        }

        // 2. ЕСЛИ НА ПРОВЕРКЕ — отрисовываем мгновенно из кэша (оптимистично)
        if (cached && cached.status === 'checking') {
            if (!badge.hasAttribute('data-checked')) {
                applyStatusToDOM('checking', badge, lesson);
                // НЕ ставим data-checked, чтобы fetchRealStatus сработал в фоне один раз
            }
        }

        // 3. АКТУАЛИЗАЦИЯ (для всех, кто не 'passed', или если кэша нет)
        // Чтобы не спамить API, проверяем только если еще не синхронизировали в этой сессии
        if (!lesson.hasAttribute('data-api-synced')) {
            lesson.setAttribute('data-api-synced', 'true');
            fetchRealStatus(lessonId, badge, lesson);
        }
    }

    function applyLogic() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            retryCount.clear();
            document.querySelectorAll('[data-checked]').forEach(el => el.removeAttribute('data-checked'));
        }

        // --- ОБРАБОТКА УРОКОВ ---
        document.querySelectorAll('.mUkKn').forEach(lesson => {
            const badge = lesson.querySelector('.Rjxh7');
            if (!badge) return;

            processVisuals(lesson);

            if (badge.classList.contains('Plz9L') && !badge.hasAttribute('data-checked')) return;
            processStatusLogic(lesson, badge);
        });

        // --- ОБРАБОТКА КАРТОЧЕК КУРСОВ (НОВОЕ) ---
        document.querySelectorAll('.UAktb').forEach(courseCard => {
            processCourseCard(courseCard);
        });
    }

    window.addEventListener('scroll', applyLogic, {passive: true});
    document.addEventListener('click', () => setTimeout(applyLogic, 100));
    new MutationObserver(updateThemeClass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    updateThemeClass();
    setInterval(applyLogic, 600);

    function interpolateColor(color1, color2, factor) {
        const parse = c => ({
            r: parseInt(c.substring(1, 3), 16),
            g: parseInt(c.substring(3, 5), 16),
            b: parseInt(c.substring(5, 7), 16)
        });
        const c1 = parse(color1), c2 = parse(color2);
        const r = Math.round(c1.r + factor * (c2.r - c1.r));
        const g = Math.round(c1.g + factor * (c2.g - c1.g));
        const b = Math.round(c1.b + factor * (c2.b - c1.b));
        const hex = x => x.toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    function getSmartColor(p) {
        if (p >= 90) return '#00D05A';
        if (p < 33) return interpolateColor('#FF4747', '#FFD93D', p / 33);
        if (p < 66) return interpolateColor('#FFD93D', '#95CD41', (p - 33) / 33);
        return interpolateColor('#95CD41', '#00D05A', (p - 66) / 24);
    }

    async function processTaskCapture(taskElement, btn) {
        // 1. Скрываем кнопку, чтобы её не было на скрине
        btn.style.visibility = 'hidden';

        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            const canvas = await html2canvas(taskElement, {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                scale: 2,
                useCORS: true,
                logging: false
            });

            // 2. Копирование в буфер обмена
            canvas.toBlob(async (blob) => {
                try {
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    showToast("Скопировано в буфер!");
                } catch (err) {
                    console.error("Буфер не сработал:", err);
                }
            });

            // 3. Сохранение файла
            const link = document.createElement('a');
            const taskName = taskElement.querySelector('.XZTcz')?.innerText || 'Task';
            link.download = `${taskName.replace(/[^a-zа-я0-9]/gi, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (e) {
            console.error("Ошибка захвата:", e);
        } finally {
            btn.style.visibility = 'visible';
        }
    }

    // Вспомогательная функция уведомления
    function showToast(text) {
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.innerText = text;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    async function downloadAllHomework(btn) {
        const taskButtons = document.querySelectorAll('.Hlt15'); // Кнопки номеров 1, 2, 3...
        if (taskButtons.length === 0) return;

        const originalActive = document.querySelector('.Hlt15.HqV_y'); // Запоминаем текущую
        btn.disabled = true;
        btn.innerText = '⌛ Загрузка...';

        for (let i = 0; i < taskButtons.length; i++) {
            const tBtn = taskButtons[i];
            tBtn.click(); // Переключаем задачу

            btn.innerText = `📸 Задание ${i + 1}/${taskButtons.length}`;

            // Ждем подгрузки контента (ждем, пока появится текст внутри .ck-content)
            await new Promise(resolve => {
                let checks = 0;
                const interval = setInterval(() => {
                    const content = document.querySelector('.ck-content');
                    // Проверяем, что текст обновился (не пустой и не старый)
                    if (content && content.innerText.length > 10 || checks > 20) {
                        clearInterval(interval);
                        setTimeout(resolve, 500); // Небольшая пауза для рендера формул
                    }
                    checks++;
                }, 100);
            });

            // Делаем скриншот текущей подгруженной задачи
            const taskElement = document.querySelector('.dJ46J');
            const captureBtn = taskElement.querySelector('.download-task-btn');

            // Используем твою логику захвата, но без Clipboard (чтобы не спамить в буфер)
            await silentTaskCapture(taskElement, captureBtn);
        }

        // Возвращаемся в начало
        if (originalActive) originalActive.click();
        btn.disabled = false;
        btn.innerText = '✅ Готово!';
        setTimeout(() => { btn.innerText = '📥 Скачать всё (PNG)'; }, 3000);
    }

    // Упрощенная версия захвата без буфера обмена для массовой скачки
    async function silentTaskCapture(taskElement, btn) {
        if (btn) btn.style.visibility = 'hidden';
        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const canvas = await html2canvas(taskElement, {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                scale: 2,
                useCORS: true
            });
            const link = document.createElement('a');
            const taskName = taskElement.querySelector('.XZTcz')?.innerText || 'Task';
            link.download = `${taskName.replace(/[^a-zа-я0-9]/gi, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {}
        if (btn) btn.style.visibility = 'visible';
    }

    // Функция для вставки кнопки «Скачать всё»
    function initGlobalDownload() {
        if (!settings.showMassCaptureBtn) return;

        const container = document.querySelector('.s_wDL'); // Контейнер с цифрами задач
        if (container && !document.querySelector('.download-all-tasks-btn')) {
            const btn = document.createElement('button');
            btn.className = 'download-all-tasks-btn';
            btn.innerText = '📥 Скачать всё (PNG)';
            btn.onclick = () => downloadAllHomework(btn);
            container.parentElement.appendChild(btn);
        }
    }

    // Инициализация кнопок
    function initDownloadButtons() {
        if (!settings.showCaptureBtn) return;
        // Ищем блоки задач
        document.querySelectorAll('.dJ46J:not(.has-capture-btn)').forEach(task => {
            task.classList.add('has-capture-btn');

            const btn = document.createElement('button');
            btn.className = 'download-task-btn';
            btn.title = "Скачать и копировать";
            btn.innerHTML = '📷'; // Короткая иконка для квадрата

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                processTaskCapture(task, btn);
            };

            task.appendChild(btn);
        });
    }

    function initVideoResizer() {
        const videoContainers = document.querySelectorAll('.gDPOa');

        videoContainers.forEach(container => {
            // Если уголка нет - создаем
            if (!container.querySelector('.video-resizer-handle')) {
                const handle = document.createElement('div');
                handle.className = 'video-resizer-handle';
                container.appendChild(handle);

                handle.onmousedown = function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Защитный слой на весь экран
                    const globalOverlay = document.createElement('div');
                    Object.assign(globalOverlay.style, {
                        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                        zIndex: '2147483647', cursor: 'nwse-resize'
                    });
                    document.body.appendChild(globalOverlay);

                    const chat = container.parentElement.querySelector('.vqMgR');
                    if (chat) chat.style.pointerEvents = 'none';

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = container.offsetWidth;
                    const startHeight = container.offsetHeight;

                    // Подготовка родителей
                    let p = container.parentElement;
                    while (p && p.tagName !== 'MAIN') {
                        p.classList.add('force-resizable-limit');
                        p = p.parentElement;
                    }

                    function doDrag(ev) {
                        const deltaX = ev.clientX - startX;
                        const deltaY = ev.clientY - startY;

                        if (startWidth + deltaX > 300) {
                            container.style.width = (startWidth + deltaX) + 'px';
                            container.style.maxWidth = 'none';
                        }
                        if (startHeight + deltaY > 150) {
                            container.style.height = (startHeight + deltaY) + 'px';
                        }
                    }

                    function stopDrag() {
                        if (globalOverlay.parentNode) globalOverlay.parentNode.removeChild(globalOverlay);
                        if (chat) chat.style.pointerEvents = 'auto';
                        document.removeEventListener('mousemove', doDrag);
                        document.removeEventListener('mouseup', stopDrag);
                    }

                    document.addEventListener('mousemove', doDrag);
                    document.addEventListener('mouseup', stopDrag);
                };
            }
        });
    }

    // Функция для отрисовки кнопки закрытия
    function initChatControl() {
        // Проверяем настройку в localStorage (или через твой объект настроек)
        const showCloseBtn = localStorage.getItem('showChatCloseBtn') !== 'false';
        if (!showCloseBtn) {
            document.querySelectorAll('.chat-close-btn').forEach(b => b.remove());
            return;
        }

        const chatContainer = document.querySelector('.vqMgR');
        if (chatContainer && !chatContainer.querySelector('.chat-close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'chat-close-btn';
            closeBtn.innerText = 'Скрыть чат ✕';
            closeBtn.onclick = () => {
                chatContainer.classList.add('chat-hidden');
                // Опционально: сохраняем состояние, чтобы чат не открылся сам при переходе
                // localStorage.setItem('chatIsHidden', 'true');
            };
            chatContainer.appendChild(closeBtn);
        }
    }

    function updateChatControl() {
        const chatContainer = document.querySelector('.vqMgR');
        if (!chatContainer) return;

        // Если настройка выключена — удаляем кнопку, если она была
        if (!settings.showChatCloseBtn) {
            const existingBtn = chatContainer.querySelector('.chat-close-btn');
            if (existingBtn) existingBtn.remove();
            return;
        }

        // Если настройка включена и кнопки еще нет — создаем
        if (!chatContainer.querySelector('.chat-close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'chat-close-btn';
            closeBtn.innerText = 'Скрыть чат ✕';

            closeBtn.onclick = () => {
                chatContainer.classList.toggle('chat-hidden');
                closeBtn.innerText = chatContainer.classList.contains('chat-hidden')
                    ? 'Показать чат 👁'
                : 'Скрыть чат ✕';
            };

            chatContainer.appendChild(closeBtn);
        }
    }

    function setupResizerEvents(container, handle) {
        handle.onmousedown = function(e) {
            e.preventDefault();
            e.stopPropagation(); // Чтобы клик не ушел в плеер

            const globalOverlay = document.createElement('div');
            Object.assign(globalOverlay.style, {
                position: 'fixed',
                top: '0', left: '0', width: '100vw', height: '100vh',
                zIndex: '2147483647', cursor: 'nwse-resize'
            });
            document.body.appendChild(globalOverlay);

            const chat = container.parentElement.querySelector('.vqMgR');
            if (chat) chat.style.pointerEvents = 'none';

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = container.offsetWidth;
            const startHeight = container.offsetHeight;

            const parentsToResize = [];
            let p = container.parentElement;
            while (p && p.tagName !== 'MAIN') {
                p.classList.add('force-resizable-limit');
                parentsToResize.push(p);
                p = p.parentElement;
            }

            function doDrag(ev) {
                const newWidth = startWidth + (ev.clientX - startX);
                const newHeight = startHeight + (ev.clientY - startY);

                if (newWidth > 300) {
                    // Меняем ширину ТОЛЬКО видео-контейнера
                    container.style.width = newWidth + 'px';
                    container.style.maxWidth = 'none';

                    // Родители расширятся сами, так как у них теперь fit-content в CSS
                }

                if (newHeight > 150) {
                    container.style.height = newHeight + 'px';
                }
            }

            function stopDrag() {
                if (globalOverlay.parentNode) globalOverlay.parentNode.removeChild(globalOverlay);
                if (chat) chat.style.pointerEvents = 'auto';
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
            }

            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        };
    }

    // Запуск всего
    const init = () => {
        if (!document.body) return setTimeout(init, 100);
        createMenu();
        updateDynamicStyles();
        updateThemeClass();
    };

    init();

    setInterval(() => {
        applyLogic();

        // 1. Логика ресайза видео (если включена)
        if (settings.videoResizer) {
            initVideoResizer();
        }

        // 2. Логика кнопки скрытия чата (если включена настройка)
        updateChatControl();

        initDownloadButtons();
        initGlobalDownload();
    }, 800);

    new MutationObserver(updateThemeClass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('scroll', applyLogic, {passive: true});
})();
