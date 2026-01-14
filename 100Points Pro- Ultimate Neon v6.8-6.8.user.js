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
// ==/UserScript==

(function() {
    'use strict';

    let authToken = null;
    let cache = new Map();
    let retryCount = new Map();
    let lastUrl = location.href;

   let settings = JSON.parse(localStorage.getItem('100pts_settings')) || {
        cardStyle: 'default',
        badgeStyle: 'flat', // Для плашки
        barStyle: 'default',
        fontStyle: 'default',
        fontSize: 14,
        cardPadding: 100
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
    { id: 'gold-leaf', name: 'Золотая кайма' }
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
        .UAktb { border: 2px solid #775AFA !important; border-radius: 24px !important; background: #ffffff !important; box-shadow: 0 15px 35px rgba(119, 90, 250, 0.15) !important; padding: 15px !important; margin-bottom: 30px !important; }
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

/* --- БАЗОВЫЙ БЕЛЫЙ ФОН ДЛЯ ВСЕХ КАСТОМНЫХ КАРТОЧЕК --- */
.custom-card-active {
    background: #ffffff !important;
    border: none !important;
}

/* 1. КОНТУРНЫЙ НЕОН (ПОФИКШЕННЫЙ БЕЛЫЙ) */
.style-neon-border {
    border: 2px solid var(--card-color) !important;
    box-shadow: 0 0 15px var(--card-color) !important;
}

/* 2. КИБЕРПАНК (СВЕТЛЫЙ) */
.style-cyber-card {
    border-left: 8px solid var(--card-color) !important;
    clip-path: polygon(0 0, 100% 0, 100% 85%, 92% 100%, 0 100%);
    border-bottom: 1px solid #eee !important;
}

/* 3. МЯГКИЙ ОКЕАН */
.style-soft-ocean {
    background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%) !important;
    border-left: 5px solid #0077ff !important;
    border-radius: 12px 24px 24px 12px !important;
}

/* 4. ЛИСТ БУМАГИ (С ЗАГНУТЫМ УГОЛКОМ) */
.style-paper-sheet {
    box-shadow: 2px 2px 10px rgba(0,0,0,0.05) !important;
    border: 1px solid #eee !important;
    background: linear-gradient(135deg, transparent 20px, #ffffff 0) !important;
}

/* 5. ГРАДИЕНТНОЕ СИЯНИЕ */
.style-gradient-glow {
    border: 2px solid transparent !important;
    background-image: linear-gradient(#fff, #fff), linear-gradient(to right, var(--card-color), #775AFA) !important;
    background-origin: border-box !important;
    background-clip: padding-box, border-box !important;
}

/* 6. ГЛУБОКАЯ ТЕНЬ (ЭФФЕКТ ПАРЕНИЯ) */
.style-shadow-depth {
    box-shadow: 0 20px 40px rgba(0,0,0,0.08) !important;
    transform: translateY(-2px);
}

/* 7. БРУТАЛИЗМ (ЖЕСТКИЕ ГРАНИЦЫ) */
.style-brutalist {
    border: 3px solid #000 !important;
    box-shadow: 8px 8px 0px var(--card-color) !important;
}

/* 8. ТОЧЕЧНАЯ СЕТКА */
.style-dot-grid {
    background-image: radial-gradient(#e0e0e0 1px, transparent 1px) !important;
    background-size: 15px 15px !important;
    border: 1px solid #ddd !important;
}

/* 9. РАДУЖНАЯ ГРАНЬ */
.style-rainbow-edge {
    border-bottom: 4px solid transparent !important;
    border-image: linear-gradient(to right, #ff4747, #ffa500, #00d05a, #775afa) 1 !important;
}

/* 10. НЕО-РЕТРО */
.style-neo-retro {
    background: #fffcf5 !important;
    border: 2px dashed var(--card-color) !important;
    border-radius: 0px !important;
}

/* 11. МОРОЗНАЯ МЯТА */
.style-frosted-mint {
    background: linear-gradient(135deg, #ffffff 0%, #e6fffa 100%) !important;
    border: 2px solid #b2f5ea !important;
}

/* 12. ЗОЛОТАЯ КАЙМА */
.style-gold-leaf {
    border: 1px solid #d4af37 !important;
    box-shadow: inset 0 0 10px rgba(212, 175, 55, 0.1) !important;
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

                    // 1. Обновляем кэш
                    cache.set(lessonId, { status, deadline, is_deadline_passed: isPassed });

                    // 2. Сначала логика фикса текста в кнопке (без отрисовки плашки)
                    applyStatusToDOM(status, badge, lessonNode, deadline);

                    // 3. И только теперь вызываем отрисовку визуала (она сама решит: 0% или время)
                    processVisuals(lessonNode);
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

            <button id="pts-close" style="width: 100%; padding: 12px; background: #775AFA; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; margin-top: 10px;">Готово</button>
        `;
        document.body.appendChild(menu);

        // ЛОГИКА ОТКРЫТИЯ
        btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
        document.getElementById('pts-close').onclick = () => menu.classList.remove('open');

        // ОБРАБОТКА ВСЕХ ИЗМЕНЕНИЙ (oninput для живого отклика)
        menu.querySelectorAll('.pts-select, .pts-range').forEach(el => {
            const updateAll = () => {
                const key = el.dataset.setting;
                let val = el.value;

                if (el.type === 'range') {
                    val = parseInt(val);
                    const labelId = key === 'fontSize' ? 'font-val' : 'card-val';
                    document.getElementById(labelId).innerText = val;
                }

                settings[key] = val;
                saveSettings();
                updateDynamicStyles(); // Мгновенно меняет масштаб и шрифт через CSS
                document.querySelectorAll('.mUkKn').forEach(processVisuals); // Мгновенно меняет стили карточек
            };

            el.oninput = updateAll;
            el.onchange = updateAll;
        });
    }

    function processVisuals(lesson) {
    const link = lesson.querySelector('a');
    const lessonId = link?.href.match(/lesson\/(\d+)/)?.[1];
    const lessonData = cache.get(lessonId); // Данные из API
    const progressBar = lesson.querySelector('.D0VIa');

    // 1. Считаем процент из прогресс-бара (он доступен сразу без API)
    const p = progressBar ? (parseInt(progressBar.style.width) || 0) : 0;

    let finalColor = (settings.barStyle === 'dynamic')
        ? getSmartColor(p)
        : (p >= 90 ? '#00D05A' : p > 70 ? '#ADFF2F' : p > 30 ? '#FFA500' : '#FF4747');

    // --- 1. СБРОС КАРТОЧКИ ---
    const currentClasses = Array.from(lesson.classList);
    currentClasses.forEach(cls => { if (cls.startsWith('style-')) lesson.classList.remove(cls); });
    lesson.style.clipPath = '';
    lesson.style.borderRadius = '';
    lesson.style.setProperty('--card-color', finalColor);

    if (settings.cardStyle && settings.cardStyle !== 'default') {
        lesson.classList.add('custom-card-active', 'style-' + settings.cardStyle);
    } else {
        lesson.classList.remove('custom-card-active');
    }

    // --- 2. ПОДГОТОВКА ПЛАШКИ ---
    let pbBadge = lesson.querySelector('.custom-percent-badge');
    if (!pbBadge) {
        pbBadge = document.createElement('div');
        pbBadge.className = 'custom-percent-badge';
        lesson.appendChild(pbBadge);
    }

    pbBadge.className = 'custom-percent-badge';
    pbBadge.style.background = '';
    pbBadge.style.color = 'white';
    pbBadge.style.display = 'none';

    // --- 3. ЛОГИКА ОПРЕДЕЛЕНИЯ КОНТЕНТА ---
    let badgeText = '';
    let badgeColor = finalColor;
    let isUrgent = false;

    // СНАЧАЛА ПРОВЕРЯЕМ ПРОЦЕНТЫ (Работает без API!)
    if (p > 0) {
        badgeText = p + '%';
        badgeColor = finalColor;
    }
    // ДЕДЛАЙНЫ (Нуждаются в API)
    else if (lessonData) {
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

    // --- 4. ОТРИСОВКА ---
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

    // --- 5. ПРОГРЕСС-БАР ---
    if (progressBar) {
        progressBar.style.setProperty('background-color', finalColor, 'important');
        progressBar.style.setProperty('box-shadow', `0 0 10px ${finalColor}`, 'important');
    }
}

    function processStatusLogic(lesson, badge) {
        const link = lesson.querySelector('a');
        if (authToken && link && !badge.hasAttribute('data-checked')) {
            const id = link.href.match(/lesson\/(\d+)/)?.[1];
            if (id) {
                badge.setAttribute('data-checked', 'processing');
                fetchRealStatus(id, badge, lesson);
            }
        }
    }

    function applyLogic() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            cache.clear();
            retryCount.clear();
            document.querySelectorAll('[data-checked]').forEach(el => el.removeAttribute('data-checked'));
        }

        document.querySelectorAll('.mUkKn').forEach(lesson => {
            const badge = lesson.querySelector('.Rjxh7');
            if (!badge) return;

            // Просто запускаем визуал, он сам всё прочитает
            processVisuals(lesson);

            if (badge.classList.contains('Plz9L') && !badge.hasAttribute('data-checked')) return;
            processStatusLogic(lesson, badge);
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

    // Запуск всего
    const init = () => {
        if (!document.body) return setTimeout(init, 100);
        createMenu();
        updateDynamicStyles();
        updateThemeClass();
    };

    init();
    setInterval(applyLogic, 600);
    new MutationObserver(updateThemeClass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('scroll', applyLogic, {passive: true});
})();
