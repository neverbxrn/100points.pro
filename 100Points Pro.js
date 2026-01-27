// ==UserScript==
// @name         100Points Pro: Tweaks
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Твики для стобалльного
// @author       bebebebebe
// @match        https://lk.100points.ru/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      api.100points.ru
// @run-at       document-start
// @require https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @require https://cdnjs.cloudflare.com/ajax/libs/dom-to-image-more/3.5.0/dom-to-image-more.min.js
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

    // Глобальное хранилище данных таймера
    window.MY_TIMER_DATA = {
        endTime: null,
        lessonId: null
    };

    // 1. Перехват FETCH
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0];
        if (typeof url === 'string' && url.includes('/main')) {
            const clone = response.clone();
            clone.json().then(data => handleCapturedData(data, url));
        }
        return response;
    };

    // 2. Перехват XHR (на всякий случай)
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        this.addEventListener('load', () => {
            if (this.responseURL.includes('/main')) {
                try {
                    handleCapturedData(JSON.parse(this.responseText), this.responseURL);
                } catch (e) {}
            }
        });
        return open.apply(this, arguments);
    };

    function handleCapturedData(data, url) {
        const lessonId = url.match(/lessons\/(\d+)\/main/)?.[1];
        const maxSec = data.homeworks?.max_time_seconds || 0;

        if (lessonId && maxSec > 0) {
            const endTime = Date.now() + (maxSec * 1000);
            window.MY_TIMER_DATA = { endTime, lessonId };
            localStorage.setItem(`timer_v3_${lessonId}`, endTime);
        } else if (lessonId) {
            localStorage.setItem(`timer_v3_${lessonId}`, '0'); // Таймер не нужен
        }
    }

// --- КОНФИГУРАЦИЯ ---
const DRAFTS_KEY = 'hwork_ultimate_drafts';
const _nFetch = window.fetch;
const _nXSend = XMLHttpRequest.prototype.send;
const _nXOpen = XMLHttpRequest.prototype.open;

// Теперь это объект: { "ID1": [...], "ID2": [...] }
let hwork_drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}');
let isManualClick = false;

// 1. Фиксация клика
document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.xw85C')) {
        isManualClick = true;
        console.log("%c[Drafts Debug] Клик зафиксирован!", "color: #00ffaa; font-weight: bold;");
        setTimeout(() => { isManualClick = false; }, 5000);
    }
}, true);

// 2. Универсальный разборщик FormData и JSON
function getRequestData(body) {
    if (!body) return null;
    const data = {};

    if (body instanceof FormData) {
        // Вытаскиваем все поля из FormData (answer, last_homework_draft_id и др.)
        for (let [key, value] of body.entries()) {
            data[key] = value;
        }
        return data;
    }

    try {
        if (typeof body === 'string') return JSON.parse(body);
    } catch (e) {
        console.error("[Drafts Debug] Не удалось распарсить строку:", e);
    }
    return null;
}

// 3. Подсчет ответов (теперь лезем в поле 'answer')
function countAnswersInPayload(data) {
    try {
        // В FormData поле 'answer' — это строка JSON, её надо распарсить для счета
        const answerArray = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
        if (!Array.isArray(answerArray)) return 0;

        return answerArray.filter(item => {
            if (!item.answer || !Array.isArray(item.answer)) return false;
            return item.answer.some(sub => {
                if (Array.isArray(sub)) return sub.some(v => v && v.toString().trim() !== "");
                return sub && sub.toString().trim() !== "";
            });
        }).length;
    } catch (e) {
        return 0;
    }
}

// 4. Сохранение
function saveToDrafts(url, body) {
    const data = getRequestData(body);
    if (!data) return;

    const hwId = url.match(/homework\/(\d+)\/save/)?.[1] || '???';
    const answersCount = countAnswersInPayload(data);

    const newDraft = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hwId: hwId,
        url: url,
        payload: data,
        count: answersCount
    };

    // Если для этого ID еще нет списка — создаем
    if (!hwork_drafts[hwId]) hwork_drafts[hwId] = [];

    // Добавляем в начало списка именно этой домашки
    hwork_drafts[hwId].unshift(newDraft);

    // Ограничение: 10 черновиков именно для этой домашки
    hwork_drafts[hwId] = hwork_drafts[hwId].slice(0, 10);

    localStorage.setItem(DRAFTS_KEY, JSON.stringify(hwork_drafts));
    console.log(`%c[Drafts Debug] СОХРАНЕНО для ID ${hwId}!`, "background: #008800; color: #fff; padding: 2px 5px;");
}

// 5. Перехватчики (XHR и Fetch)
window.fetch = async (...args) => {
    const url = args[0];
    const options = args[1];
    if (isManualClick && typeof url === 'string' && url.includes('/save') && options?.method === 'POST') {
        isManualClick = false;
        saveToDrafts(url, options.body);
    }
    return _nFetch(...args);
};

XMLHttpRequest.prototype.open = function(m, u) { this._u = u; this._m = m; return _nXOpen.apply(this, arguments); };
XMLHttpRequest.prototype.send = function(body) {
    if (isManualClick && this._u && this._u.includes('/save') && this._m === 'POST') {
        isManualClick = false;
        saveToDrafts(this._u, body);
    }
    return _nXSend.apply(this, arguments);
};

// 6. Восстановление (Имитируем FormData на 100%)
async function restoreHworkDraft(draft) {
    if (!confirm(`Восстановить черновик от ${draft.time}?`)) return;

    try {
        // Создаем настоящий FormData, чтобы сервер принял запрос
        const fd = new FormData();
        for (let key in draft.payload) {
            fd.append(key, draft.payload[key]);
        }

        const res = await _nFetch(draft.url, {
            method: 'POST',
            headers: {
                // ПРИМЕЧАНИЕ: Content-Type для FormData браузер ставит САМ
                'Authorization': typeof authToken !== 'undefined' ? authToken : ''
            },
            body: fd
        });

        if (res.ok) {
            alert('Черновик успешно применен! Перезагружаю...');
            location.reload();
        } else {
            const errText = await res.text();
            console.error("[Drafts Debug] Ответ сервера:", errText);
            alert('Ошибка сервера при восстановлении. Проверьте консоль.');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка сети.');
    }
}

    // 1. Подключаем шрифт Unbounded
    if (!document.getElementById('pts-font-unbounded')) {
        const link = document.createElement('link');
        link.id = 'pts-font-unbounded';
        link.href = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }

    let currentHomeworkData = null;

    function updatePointsUI() {
        if (!window.location.href.includes('/checked/')) return;

        if (lastUrl !== window.location.href) {
            lastUrl = window.location.href;
            currentHomeworkData = null;
        }

        const pointsEl = document.querySelector('p.rqYJV.hIPyM');
        if (!pointsEl) return;

        // Прячем стандартный текст (то самое убогое 0), пока не готовы наши данные
        if (!pointsEl.dataset.lastNum) {
            pointsEl.style.opacity = '0';
        }

        const activeBtn = document.querySelector('button.HqV_y');
        if (!activeBtn) return;

        const activeNum = parseInt(activeBtn.innerText.trim());

        if (!currentHomeworkData && !window.isPtsFetching) {
            const match = window.location.href.match(/homework\/(\d+)\/checked\/(\d+)/);
            if (match) fetchHomeworkData(match[1], match[2]);
            return;
        }

        if (currentHomeworkData) {
            const question = currentHomeworkData.find(q => q.order_id === activeNum);
            if (pointsEl.dataset.lastNum === String(activeNum)) return;

            if (question) {
                renderPoints(pointsEl, question.points, activeNum);
            }
        }
    }

    function fetchHomeworkData(hwId, checkedId) {
        window.isPtsFetching = true;
        console.log(`%c[PTS] Запрос данных для №${hwId}...`, "color: #00ffff");

        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.100points.ru/api/student/homework/${hwId}/questionsBy/${checkedId}`,
            headers: { "Authorization": authToken, "Accept": "application/json" },
            onload: function(res) {
                window.isPtsFetching = false;
                try {
                    const data = JSON.parse(res.responseText);
                    if (data.questions) {
                        currentHomeworkData = data.questions;
                        console.log(`[PTS] База загружена (${data.questions.length} вопр.)`);
                    }
                } catch (e) { console.error("[PTS] Ошибка API", e); }
            }
        });
    }

    function renderPoints(el, maxPoints, activeNum) {
        // Забираем текущий балл (убираем лишний текст, если он уже был добавлен нами)
        const currentRaw = el.innerText.includes('/') ? el.innerText.split('/')[0] : el.innerText;
        const currentPoints = parseFloat(currentRaw.replace(/[^\d.]/g, '')) || 0;

        let bg = '#FF4747'; // Плохо (0)
        let shadow = 'rgba(255, 71, 71, 0.4)';

        if (currentPoints >= maxPoints && maxPoints > 0) {
            bg = '#00D05A'; // Отлично
            shadow = 'rgba(0, 208, 90, 0.4)';
        } else if (currentPoints > 0) {
            bg = '#FFA500'; // Средне
            shadow = 'rgba(255, 165, 0, 0.4)';
        }

        Object.assign(el.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 28px', // Увеличенные отступы для массивности
            backgroundColor: bg,
            color: '#FFFFFF',
            borderRadius: '14px',
            fontFamily: "'Unbounded', sans-serif",
            fontSize: '14px',
            fontWeight: '700',
            lineHeight: '1', // Чтобы текст был ровно по центру
            margin: '15px 0',
            boxShadow: `0 6px 20px ${shadow}`,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            opacity: '1',
            transform: 'scale(1)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap'
        });

        // Эффект "прыжка" при смене
        el.style.transform = 'scale(0.95)';
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 100);

        el.innerText = `Балл: ${currentPoints} / ${maxPoints}`;
        el.dataset.lastNum = String(activeNum);

        console.log(`%c[PTS] Отрисовано: ${currentPoints}/${maxPoints}`, `color: ${bg}; font-weight: bold;`);
    }

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

    const cardStyles = [
        // --- КЛАССИКА И МИНИМАЛИЗМ ---
        { id: 'pure-white', name: 'Чистый белый' },
        { id: 'glass-deep', name: 'Глубокое стекло (WebGL-ready)' },
        { id: 'border-thin', name: 'Тонкий контур' },         // Едва заметная серая граница
        { id: 'soft-blue', name: 'Небесный софт' },           // Очень бледный голубой фон
        { id: 'paper-texture', name: 'Лист бумаги' },         // Эффект наслоения

        // --- СОВРЕМЕННЫЙ ТЕХ-СТИЛЬ ---
        { id: 'glass-light', name: 'Матовое стекло' },        // Backdrop-filter blur
        { id: 'neon-border', name: 'Светлый неон' },          // Тонкая светящаяся фиолетовая линия
        { id: 'cyber-clean', name: 'Светлый киберпанк' },      // Скошенные углы (через clip-path)
        { id: 'floating', name: 'Левитация' },                // Глубокая тень, эффект высоты

        // --- ЦВЕТОВЫЕ ГРАДИЕНТЫ (СВЕТЛЫЕ) ---
        { id: 'gradient-peach', name: 'Персиковый закат' },    // Нежный оранжево-розовый
        { id: 'gradient-mint', name: 'Мятный лед' },          // Свежий бело-зеленый
        { id: 'gradient-lavender', name: 'Лавандовый сад' },   // Бледно-фиолетовый
        { id: 'gradient-sunny', name: 'Солнечный блик' },      // Теплый лимонный градиент

        // --- ЭФФЕКТЫ И ТЕКСТУРЫ ---
        { id: 'neu-flat', name: 'Мягкий неоморфизм' },        // Эффект "выпуклости" (светлые/темные тени)
        { id: 'outline-dashed', name: 'Пунктир' },            // Творческий стиль в рамке
        { id: 'shadow-colored', name: 'Цветная тень' },       // Тень цвета бренда (фиолетовая)
        { id: 'dot-grid', name: 'Точечная сетка' },           // Фон в мелкую точку

        // --- ПРЕМИАЛЬНЫЕ ---
        { id: 'royal-gold', name: 'Золотая кайма' },          // Тонкий золотистый градиент по краю
        { id: 'pearl', name: 'Жемчужный' },                   // Перламутровый перелив
        { id: 'clay', name: 'Глиняный (Claymorphism)' },      // Закругленный, объемный вид
        { id: 'minimal-list', name: 'Архивный стиль' },        // Акцент на левую границу (полоса)

        { id: 'notebook-line', name: 'Школьная тетрадь' },
        { id: 'blueprint', name: 'Инженерный чертеж' },
        { id: 'sticky-note', name: 'Стикер для заметок' },
        { id: 'graph-paper', name: 'Тетрадь в клетку' },
        { id: 'clipboard', name: 'Планшет (Clipboard)' }
    ];

    const badgeStyles = [
        { id: 'flat', name: 'Стандартный' },
        { id: 'outline', name: 'Контурный неон' },
        { id: 'glass', name: 'Стеклянный' },
        { id: 'cyber', name: 'Киберпанк' },
        { id: 'minimal', name: 'Минимализм' }
    ];

    const barStyles = [
        { id: 'default', name: 'Неоновый' },
        { id: 'dynamic', name: 'Умный градиент' },
        { id: 'liquid', name: 'Жидкий' },
        { id: 'striped', name: 'Полосатый' },
        { id: 'glow', name: 'Мягкое свечение' },
        { id: 'glass', name: 'Стеклянный' },
        { id: 'dots', name: 'Точечный' },
        { id: 'pulse', name: 'Пульсирующий' },
        { id: 'flat-clean', name: 'Минимализм' },
        { id: 'slim', name: 'Тонкая линия' },
        { id: 'segmented', name: 'Разделители' },
        { id: 'matte', name: 'Матовый плоский' }
    ];

    const fontStyles = [
        { id: 'default', name: 'Системный' },
        { id: 'Inter', name: 'Inter (Тонкий)' },
        { id: 'Montserrat', name: 'Montserrat' },
        { id: 'Raleway', name: 'Raleway (Стильный)' },
        { id: 'Exo 2', name: 'Exo 2 (Футуристичный)' },
        { id: 'Quicksand', name: 'Quicksand (Мягкий)' },
        { id: 'Tenor Sans', name: 'Tenor Sans (Элегант)' },
        { id: 'Work Sans', name: 'Work Sans (Минимализм)' },
        { id: 'Titillium Web', name: 'Titillium (Техно)' },
        { id: 'Kanit', name: 'Kanit (Тонкий закругленный)' },
        { id: 'Source Code Pro', name: 'Source Code (Кодерский)' },
        { id: 'Unbounded', name: 'Unbounded' },
        { id: 'JetBrains Mono', name: 'JetBrains' },
        { id: 'Oswald', name: 'Oswald' },
        { id: 'Roboto', name: 'Roboto (Ультра-тонкий)' },
        { id: 'Nanum Gothic', name: 'Nanum Gothic' }
    ];

    const hoverAnimations = [
        { id: 'none', name: 'Нет' },
        { id: 'lift', name: 'Подъем' },
        { id: 'scale', name: 'Увеличение' },
        { id: 'glow', name: 'Сияние' },
        { id: 'float', name: 'Левитация' }
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
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@200;300&family=Inter:wght@300;400&family=JetBrains+Mono:wght@300;700&family=Kanit:wght@200;300&family=Montserrat:wght@200;700&family=Nanum+Gothic:wght@400&family=Oswald:wght@300;500&family=Quicksand:wght@300;400&family=Raleway:wght@200;700&family=Roboto:wght@100;400&family=Source+Code+Pro:wght@200;400&family=Tenor+Sans&family=Titillium+Web:wght@200;400&family=Ubuntu:wght@300;500&family=Unbounded:wght@300;700&family=Work+Sans:wght@200;400&display=swap');

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
    position: relative;
    border-radius: 12px !important; /* Чуть мягче углы */
    /* Глубокий градиент с переходом через насыщенный синий */
    background: linear-gradient(135deg, #775AFA 0%, #666CFF 50%, #5C8AFF 100%) !important;
    /* Эффект свечения: внешняя тень + внутренний блик */
    box-shadow: 0 4px 15px rgba(119, 90, 250, 0.4),
                inset 0 1px 1px rgba(255, 255, 255, 0.3) !important;
    overflow: hidden;
}

/* --- ТЕМНАЯ ТЕМА (Исправление фона полоски) --- */
body.is-dark-mode .NUfp2 {
    /* Основной градиент заполненной части */
    background: linear-gradient(135deg, #5939e6 0%, #4a54f1 100%) !important;
    box-shadow: 0 0 20px rgba(119, 90, 250, 0.2) !important;
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

/* Кнопка перехода */
.yOmZn {
    background: rgba(119, 90, 250, 0.05) !important;
    border-top: 1px solid rgba(119, 90, 250, 0.1) !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.yOmZn:hover {
    background: rgba(119, 90, 250, 0.12) !important;
    text-decoration: none !important;
}

/* Текст внутри кнопки */
.T6RCe {
    font-weight: 600 !important;
    color: #6a4fef !important; /* Сделаем текст чуть насыщеннее вместо серого */
    transition: color 0.3s !important;
}

.yOmZn:hover .T6RCe {
    color: #775AFA !important; /* Текст становится ярче при наведении */
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
/* Главный контейнер (верхняя панель или обертка) */
        body.is-dark-mode .UAktb {
            background: linear-gradient(145deg, #1e1e3f, #16162d) !important;
            border: 1px solid rgba(139, 114, 255, 0.4) !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(139, 114, 255, 0.1) !important;
            backdrop-filter: blur(10px);
        }

/* Сама карточка урока (базовая темная тема) */
/* Мы добавляем условие, чтобы если выбрано "стекло", применялись его параметры */
body.is-dark-mode .mUkKn {
    background: #0d0d14; /* Дефолтный непрозрачный фон */
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: all 0.3s ease !important;
}

/* Если выбрано "стекло", принудительно делаем фон прозрачным поверх всех правил */
body.is-dark-mode[data-card-style="glass-deep"] .mUkKn,
body.is-dark-mode .mUkKn[style*="glass-deep"] {
    background: rgba(10, 10, 15, 0.4) !important;
}

        /* Заголовок или основной текст внутри карточки */
        body.is-dark-mode .mUkKn .eBD_9 {
            color: #ffffff !important;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
            letter-spacing: 0.3px;
        }

        /* Вспомогательные элементы (например, кнопки или плашки) */
        body.is-dark-mode .HF6wH {
            background: rgba(139, 114, 255, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #d1d1f0 !important;
            backdrop-filter: blur(4px);
        }

        /* Добавим мягкое свечение при наведении на карточку */
        body.is-dark-mode .mUkKn:hover {
            border-color: rgba(139, 114, 255, 0.6) !important;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 15px rgba(139, 114, 255, 0.2) !important;
            transform: translateY(-2px);
        }

        /* Делаем инпут ответа прозрачным в темной теме */
body.is-dark-mode .OYZIV {
    background-color: transparent !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: #ffffff !important;
}

/* Отдельно для состояния disabled, так как браузеры часто накладывают свои стили */
body.is-dark-mode .OYZIV:disabled {
    background-color: rgba(255, 255, 255, 0.03) !important; /* Еле заметный тон, чтобы поле не "провалилось" совсем */
    color: rgba(255, 255, 255, 0.5) !important;
    cursor: not-allowed;
}

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

        /* --- DARK MODE ДЛЯ МЕНЮ --- */

/* Плавающая кнопка в темной теме */
body.is-dark-mode .points-settings-btn {
    background: #775AFA !important; /* Оставляем фирменный цвет */
    border-color: #1a1a24 !important; /* Темная рамка вместо белой */
    box-shadow: 0 0 20px rgba(119, 90, 250, 0.4),
                inset 0 0 10px rgba(255, 255, 255, 0.2) !important;
}

body.is-dark-mode .points-settings-btn:hover {
    box-shadow: 0 0 30px rgba(119, 90, 250, 0.6) !important;
}

/* --- ФИКС ПОЛОСКИ PTS-RANGE В DARK MODE --- */

body.is-dark-mode .pts-range {
    -webkit-appearance: none;
    appearance: none;
    background: #252533 !important; /* Цвет незаполненной части */
    height: 6px;
    border-radius: 10px;
    outline: none;
}

/* Фон самого меню */
body.is-dark-mode #pts-menu {
    background: rgba(13, 13, 20, 0.98) !important;
    backdrop-filter: blur(15px);
    box-shadow: -5px 0 25px rgba(0, 0, 0, 0.7);
    border-left: 1px solid rgba(255, 255, 255, 0.05);
}

/* Заголовки и текст */
body.is-dark-mode #pts-menu h2 {
    color: #775AFA !important;
    border-bottom-color: rgba(255, 255, 255, 0.05) !important;
}

body.is-dark-mode .menu-section h3,
body.is-dark-mode .menu-section label {
    color: #8b8b93 !important;
}

/* Карточки выбора (style-option) */
body.is-dark-mode .style-option {
    background: rgba(255, 255, 255, 0.03) !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
    color: #eeeeee !important;
}

body.is-dark-mode .style-option:hover {
    border-color: #775AFA !important;
    background: rgba(119, 90, 250, 0.05) !important;
}

body.is-dark-mode .style-option.active {
    background: linear-gradient(145deg, #1e1e3f, #16162d) !important;
    border-color: #775AFA !important;
    color: #ffffff !important;
    box-shadow: 0 4px 15px rgba(119, 90, 250, 0.2) !important;
}

/* Выпадающие списки (select) */
body.is-dark-mode .pts-select {
    background: #1a1a24 !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    color: #ffffff !important;
}

body.is-dark-mode .pts-select:focus {
    border-color: #775AFA !important;
}

/* Разделитель */
body.is-dark-mode .menu-divider {
    border-top-color: rgba(255, 255, 255, 0.05) !important;
}

/* Кастомизация полосы прокрутки для темного меню */
body.is-dark-mode #pts-menu::-webkit-scrollbar {
    width: 6px;
}

body.is-dark-mode #pts-menu::-webkit-scrollbar-track {
    background: transparent;
}

body.is-dark-mode #pts-menu::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

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

/* ============================================================
   1. ГЛАВНЫЙ ФИКС ЛАЙАУТА (ВИДЕО + ЧАТ)
   ============================================================ */

/* Базовое расположение: Видео + Чат */
.wCNrd {
    display: flex !important;
    flex-direction: row !important;
    align-items: stretch !important;
    gap: 10px !important;
}

/* Видео-контейнер */
.gDPOa {
    flex-shrink: 0 !important;
}

/* Контейнер чата — делаем его шире, как ты просил */
.vqMgR {
    flex-grow: 1 !important;
    min-width: 450px !important; /* Увеличенная ширина */
    max-width: 600px !important;
    height: auto !important;
    display: flex !important;
    position: relative !important;
}

/* Сам фрейм чата */
.vqMgR iframe.vvT_w {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
}

/* 5. УБИРАЕМ ЛИМИТЫ У ПАРЕНТОВ */
.force-resizable-limit,
.wCNrd,
.react-tabs__tab-panel {
    max-width: none !important;
    width: 100% !important;
}

/* Сброс для родителя: если мы не в режиме ресайза, возвращаем стандарт */
.wCNrd:not(:has(.video-resizer-handle)) {
    display: block !important; /* Или какой там был стандарт у Kinescope */
    height: auto !important;
}

/* Прячем ручку, если скрипт ресайза просто скрывает её, а не удаляет */
.resizer-hidden .video-resizer-handle {
    display: none !important;
}

/* Фикс для родителя, чтобы кнопка не улетала */
.wCNrd {
    position: relative !important;
}

/* Состояние скрытого чата */
.vqMgR.chat-hidden {
    display: none !important; /* Полностью убираем из потока */
}

/* Если чат скрыт, заставляем видео занять 100% */
.vqMgR.chat-hidden + .gDPOa,
.gDPOa:has(+ .vqMgR.chat-hidden),
.wCNrd:has(.chat-hidden) .gDPOa {
    width: 100% !important;
    max-width: 100% !important;
    flex: 1 1 100% !important;
}

/* Гарантируем, что кнопка не перекроется плеером */
.chat-close-btn {
    pointer-events: auto !important;
    visibility: visible !important;
    opacity: 1 !important;
}

.vqMgR.chat-hidden .chat-close-btn {
    /* Когда чат скрыт, кнопка должна остаться видна (например, поверх видео) */
    position: fixed;
    right: 30px;
    top: 100px; /* Подстрой под интерфейс */
}

/* Прячем сам контейнер чата */
.vqMgR.chat-hidden {
    display: none !important;
    width: 0 !important;
    flex: 0 0 0 !important;
}

/* Кнопка, когда чат скрыт (выплывает сбоку) */
.chat-close-btn.floating-toggle {
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #FF4747 !important; /* Красная, чтобы заметно */
}

/* Фикс для видео, когда чат скрыт */
.wCNrd:has(.chat-hidden) .gDPOa {
    width: 100% !important;
    max-width: 100% !important;
}

/* Глобальное подавление ассистивных элементов MathJax */
mjx-assistive-mml {
    opacity: 0 !important;
    clip: rect(1px, 1px, 1px, 1px) !important;
    user-select: none !important;
}

/* Базовый сброс для всех кнопок навигации */
.Hlt15 {
    position: relative !important;
    opacity: 1 !important;           /* Убираем прозрачность полностью */
    border: none !important;
    color: #FFFFFF !important;       /* Белый текст для контраста */
    font-weight: 800 !important;     /* Жирный текст */
    transition: all 0.2s ease !important;
    box-shadow: none !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.4) !important;
}

/* --- ЗЕЛЕНЫЕ (_sXkU) --- */
.Hlt15._sXkU:not(.MqrGg) {
    background-color: #2ebc59 !important;
    box-shadow: 0 0 10px rgba(46, 188, 89, 0.6),
                0 0 20px rgba(46, 188, 89, 0.4) !important;
}

/* --- КРАСНЫЕ (YpU_g) --- */
.Hlt15.YpU_g {
    background-color: #eb5757 !important;
    box-shadow: 0 0 10px rgba(235, 87, 87, 0.7),
                0 0 20px rgba(235, 87, 87, 0.5) !important;
}

/* --- ЖЕЛТЫЕ (_sXkU MqrGg) --- */
/* Используем оба класса для точности */
.Hlt15._sXkU.MqrGg {
    background-color: #f7b500 !important;
    color: #000 !important; /* На желтом черный текст лучше */
    box-shadow: 0 0 10px rgba(247, 181, 0, 0.7),
                0 0 20px rgba(247, 181, 0, 0.5) !important;
    text-shadow: none !important;
}

/* --- ЭФФЕКТ ПРИ НАЖАТИИ (АКТИВАЦИЯ) --- */
.Hlt15:active {
    transform: scale(0.88) !important; /* Кнопка "вдавливается" */
    filter: brightness(1.7) !important; /* Резкая вспышка яркости */
    box-shadow: 0 0 35px rgba(255, 255, 255, 0.9) !important; /* Белый неоновый взрыв */
    transition: all 0.05s !important;
}

/* Эффект при наведении */
.Hlt15:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
    z-index: 10;
}

/* ТЕКУЩАЯ КНОПКА (Где находится пользователь) */
.Hlt15.HqV_y {
    transform: scale(1.1) !important;
    outline: 2px solid white !important;
    outline-offset: 2px;
    z-index: 5;
}

/* Если тема светлая, добавим легкую темную подложку под свечение для видимости */
[data-theme='light'] .Hlt15 {
    box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
}

/* --- ОБЩИЙ СТИЛЬ КНОПОК --- */
.Hlt15 {
    flex-shrink: 0 !important;
    width: 42px !important;
    height: 42px !important;
    border-radius: 10px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 800 !important;
    font-size: 15px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    cursor: pointer !important;
    position: relative !important;
    opacity: 1 !important;
}

/* --- БЕЛЫЕ КНОПКИ (Без спец. классов) --- */
/* Четкая обводка и черные цифры */
.Hlt15:not(.jxyvi):not(.YpU_g):not(._sXkU):not(.HqV_y) {
    background-color: #ffffff !important;
    color: #1a1a1a !important; /* Черные цифры */
    border: 2px solid #d1d1d1 !important; /* Заметная обводка */
    box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
}

/* Если активная кнопка — это обычная белая кнопка, цифры должны быть черными */
.Hlt15.HqV_y:not(.jxyvi):not(.YpU_g):not(._sXkU) {
    color: #000000 !important;
    background-color: #ffffff !important;
    border: 2px solid #000000 !important;
}

/* --- ЗЕЛЕНЫЕ (_sXkU) --- */
.Hlt15._sXkU:not(.MqrGg):not(.jxyvi) {
    background-color: #2ebc59 !important;
    color: white !important;
    box-shadow: 0 0 15px rgba(46, 188, 89, 0.5) !important;
}

/* --- КРАСНЫЕ (YpU_g) --- */
.Hlt15.YpU_g:not(.jxyvi) {
    background-color: #eb5757 !important;
    color: white !important;
    box-shadow: 0 0 15px rgba(235, 87, 87, 0.5) !important;
}

/* --- ЖЕЛТЫЕ (_sXkU MqrGg) --- */
.Hlt15._sXkU.MqrGg {
    background-color: #f7b500 !important;
    color: #000 !important;
    box-shadow: 0 0 15px rgba(247, 181, 0, 0.5) !important;
}

/* --- ФИОЛЕТОВЫЕ (jxyvi) --- */
/* Важно: jxyvi без других меток или в чистом виде */
.Hlt15.jxyvi:not(._sXkU):not(.YpU_g) {
    background-color: #9b51e0 !important;
    color: white !important;
    box-shadow: 0 0 15px rgba(155, 81, 224, 0.6),
                inset 0 0 8px rgba(255, 255, 255, 0.3) !important;
}

/* --- ТЕКУЩАЯ / АКТИВНАЯ (HqV_y) --- */
.Hlt15.HqV_y {
    transform: scale(1.15) !important;
    border: 2px solid #000 !important; /* Выделяем рамкой */
    z-index: 10 !important;
}

/* --- ЭФФЕКТ НАЖАТИЯ (ВСПЫШКА) --- */
.Hlt15:active {
    transform: scale(0.9) !important;
    filter: brightness(1.8) !important;
    box-shadow: 0 0 30px white !important;
}

/* 1. УВЕЛИЧИВАЕМ КНОПКИ ЗАДАЧ */
.Hlt15 {
    flex-shrink: 0 !important;
    width: 48px !important;  /* Было 42px, теперь 48px */
    height: 48px !important; /* Было 42px, теперь 48px */
    border-radius: 12px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 17px !important; /* Чуть крупнее цифры */
    font-weight: 800 !important;
    scroll-snap-align: center !important;
    cursor: pointer !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 2. ВОЗВРАЩАЕМ КНОПКУ "СКАЧАТЬ ВСЁ" */
/* Гарантируем, что она видна под цепочкой */
.download-all-tasks-btn {
    display: block !important;
    visibility: visible !important;
    margin: 20px auto !important; /* Отступ сверху 20px, центровка по горизонтали */
    padding: 14px 40px !important;
    border-radius: 14px !important;
    background: #000000 !important;
    color: #ffffff !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    border: none !important;
    cursor: pointer !important;
    width: fit-content !important;
    box-shadow: 0 5px 20px rgba(0,0,0,0.2) !important;
    z-index: 999 !important; /* Чтобы точно была поверх всего */
}

.download-all-tasks-btn:hover {
    background: #222 !important;
    transform: scale(1.05);
}

/* 3. КОНТЕЙНЕРЫ (Центровка и прокрутка) */
.x0P2P {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    width: 100% !important;
    padding: 10px 0 !important;
}

.QblpJ {
    display: flex !important;
    align-items: center !important;
    width: 100% !important;
    overflow-x: auto !important; /* Разрешаем прокрутку */
    scroll-behavior: smooth !important;
    scrollbar-width: none !important;
}

.QblpJ::-webkit-scrollbar {
    display: none !important;
}

.s_wDL {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 16px !important; /* Больше расстояние для крупных кнопок */
    padding: 25px 20px !important;
    margin: 0 auto !important; /* Центрирует, если задач мало */
    min-width: min-content !important;
}

/* 4. ФИКС ЦВЕТА ДЛЯ БЕЛЫХ АКТИВНЫХ КНОПОК */
.Hlt15.HqV_y:not(._sXkU):not(.YpU_g):not(.jxyvi) {
    color: #000000 !important;
    background-color: #ffffff !important;
    border: 3px solid #000000 !important; /* Сделаем рамку потолще */
}

/* Полностью скрываем стрелки */
.nEjyO {
    display: none !important;
}

/* 5. КНОПКА ЗАХВАТА ЗАДАЧИ (Обычно это стандартные кнопки сайта) */
/* Если у кнопки захвата есть специфический класс, добавь его сюда.
   Пока делаем её видимой универсально внутри контейнера. */
.x0P2P .jxyvi:not(.Hlt15) {
    margin: 10px !important;
    background-color: #007aff !important; /* Синий цвет для кнопки захвата */
    color: white !important;
}

/* Сами кнопки задач */
.Hlt15 {
    width: 48px !important;
    height: 48px !important;
    flex-shrink: 0 !important;
}

/* Фикс текста для белой активной кнопки */
.Hlt15.HqV_y:not(._sXkU):not(._sXkU.MqrGg):not(.YpU_g):not(.jxyvi) {
    color: #000 !important;
    border: 3px solid #000 !important;
    background: #fff !important;
}

/* Фикс текста для белой активной кнопки */
.Hlt15.HqV_y:not(._sXkU):not(.YpU_g):not(.jxyvi) {
    color: #000 !important;
    border: 3px solid #000 !important;
    background: #fff !important;
}

/* Окно скролла (верхняя часть подложки) */
.QblpJ {
    width: 100% !important;
    overflow-x: auto !important;
    scroll-behavior: smooth !important;
    scrollbar-width: none !important; /* Скрываем скроллбар */
    display: flex !important;
    padding-bottom: 5px !important;
}

.QblpJ::-webkit-scrollbar {
    display: none !important;
}

/* Лента с кнопками задач */
.s_wDL {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 12px !important;
    padding: 10px 20px !important;
    margin: 0 auto !important; /* Центрирует, если кнопок мало */
}

/* Кнопка "Скачать всё" (нижняя часть подложки) */
.download-all-tasks-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;

    margin-top: 15px !important; /* Отступ от ленты с задачами */
    padding: 10px 30px !important;

    background: #000000 !important;
    color: #ffffff !important;
    border-radius: 12px !important;
    font-size: 14px !important;
    font-weight: 700 !important;

    cursor: pointer !important;
    transition: transform 0.2s ease, opacity 0.2s ease !important;
    width: fit-content !important;
    flex-shrink: 0 !important; /* Чтобы кнопка не сжималась */
}

.download-all-tasks-btn:hover {
    transform: scale(1.02) !important;
    opacity: 0.9 !important;
}

/* ГЛАВНАЯ ПОДЛОЖКА (Стиль iOS 26 Glass) */
._9kveE {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;

    /* Стеклянный фон для светлой темы */
    background: rgba(255, 255, 255, 0.45) !important;
    backdrop-filter: blur(35px) saturate(180%) brightness(1.1) !important;
    -webkit-backdrop-filter: blur(35px) saturate(180%) !important;

    border-radius: 35px !important;
    border: 1.5px solid rgba(255, 255, 255, 0.4) !important;
    /* Мягкая тень и внутренний блик на грани */
    box-shadow:
        inset 0 1px 1px rgba(255, 255, 255, 0.3),
        0 10px 30px rgba(0, 0, 0, 0.08) !important;

    width: 95% !important;
    max-width: 1100px !important;
    margin: 20px auto !important;
    padding: 15px 0 !important;
    overflow: hidden !important;
    position: relative !important;
}

/* Если включена темная тема на сайте */
[data-theme='dark'] ._9kveE {
    /* Глубокое темное стекло для темной темы */
    background: rgba(15, 15, 20, 0.6) !important;
    backdrop-filter: blur(45px) saturate(190%) brightness(0.9) !important;
    -webkit-backdrop-filter: blur(45px) saturate(190%) !important;

    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-shadow:
        inset 0 0.5px 0 rgba(255, 255, 255, 0.1),
        0 15px 35px rgba(0, 0, 0, 0.5) !important;
}

/* КОНТЕЙНЕР СКРОЛЛА (Верхний ярус) */
.QblpJ {
    width: 100% !important;
    overflow-x: auto !important;
    display: flex !important;
    scrollbar-width: none !important;
    margin-bottom: 10px !important; /* Отступ до кнопки */
}
.QblpJ::-webkit-scrollbar { display: none !important; }

/* ЛЕНТА ЗАДАЧ */
.s_wDL {
    display: flex !important;
    gap: 12px !important;
    padding: 10px 20px !important;
    width: max-content !important; /* Растягивается по задачам */
    margin: 0 auto !important;      /* Центрирует, если задач мало */
}

/* КНОПКА "СКАЧАТЬ ВСЁ" (Нижний ярус) */
.download-all-tasks-btn {
    /* Отменяем влияние flex-потока для стабильности */
    position: relative !important;
    display: flex !important;

    /* Оформление */
    background: #000 !important;
    color: #fff !important;
    padding: 12px 35px !important;
    border-radius: 14px !important;
    font-weight: 700 !important;
    font-size: 15px !important;

    /* Центровка */
    margin: 10px 0 5px 0 !important;
    width: fit-content !important;
    cursor: pointer !important;
    z-index: 100 !important;
}

/* Полностью вырезаем родной таймер из верстки */
.swNXM {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
}

/* Наш новый контейнер на месте .swNXM */
.custom-timer-container {
    background: rgba(255, 255, 255, 0.6) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.4) !important;
    border-radius: 12px !important;
    padding: 8px 16px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
    margin: 10px 0 !important;
}

.custom-timer-content {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
}

.custom-timer-label {
    color: #636e72 !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
}

.custom-timer-value {
    color: #2d3436 !important;
    font-size: 16px !important;
    font-weight: 800 !important;
    font-family: 'Courier New', monospace !important; /* Моноширинный шрифт, чтобы цифры не дергались */
}

/* Таймер в тёмной теме */
body.is-dark-mode .custom-timer-container {
    background: rgba(20, 20, 35, 0.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
}

body.is-dark-mode .custom-timer-label {
    color: #9da5b1 !important; /* Приглушенный текст для метки "Осталось" */
}

body.is-dark-mode .custom-timer-value {
    color: #ffffff !important;
    font-family: 'Monaco', 'Consolas', monospace !important; /* Моноширинный шрифт для цифр */
}

/* Эффект, когда времени осталось мало (timer-low) */
body.is-dark-mode .custom-timer-value.timer-low {
    color: #ff5f5f !important;
    text-shadow: 0 0 10px rgba(255, 95, 95, 0.4) !important;
    animation: pts-timer-pulse 1.5s infinite alternate !important;
}

/* Новые правки для отображения времени начала */
.custom-timer-content {
    flex-direction: column !important; /* Стек в колонку */
    align-items: center !important;
}

.custom-timer-main {
    display: flex;
    align-items: center;
    gap: 8px;
}

.custom-timer-started {
    font-size: 11px !important;
    color: #636e72 !important;
    font-weight: 500 !important;
    margin-top: 4px !important;
    opacity: 0.8;
}

body.is-dark-mode .custom-timer-started {
    color: #9da5b1 !important;
}

#custom-timer-start-time {
    font-weight: 700 !important;
}

/* Анимация пульсации для критического времени */
@keyframes pts-timer-pulse {
    from { opacity: 1; }
    to { opacity: 0.7; }
}

/* Эффект для малого количества времени */
.timer-low {
    color: #d63031 !important;
    text-shadow: 0 0 8px rgba(214, 48, 49, 0.3) !important;
}

@keyframes timer-pulse {
    from { opacity: 1; }
    to { opacity: 0.7; }
}

.menu-group-title {
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    color: #775AFA;
    margin: 15px 0 8px 0;
    letter-spacing: 1px;
}

.menu-divider {
    margin: 10px 0;
    border: 0;
    border-top: 1px solid rgba(0,0,0,0.05);
}

/* Стили для кнопок номеров заданий в ДЗ */
.Hlt15 {
    width: var(--task-btn-size, 40px) !important;
    height: var(--task-btn-size, 40px) !important;
    border-radius: var(--task-btn-radius, 50%) !important;
    min-width: var(--task-btn-size, 40px) !important;
}

/* Стили для плашек статуса на карточках */
.badge-class-name-here { /* замени на актуальный класс плашек */
    font-size: var(--badge-size, 12px) !important;
}

/* --- СВЕТЛАЯ ТЕМА (По умолчанию) --- */
.bO43I {
    background: #ffffff !important;
    border: 1px solid #e1e4e8 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
    border-radius: 12px !important;
    padding: 20px !important;
    margin: 10px 0 !important;
    font-family: 'Unbounded', sans-serif !important;
}

.kBzTg {
    color: #1a1a1b !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px !important;
}

.mBqvc span {
    color: #57606a !important;
    font-size: 13px !important;
}

.SIFGw {
    background: #f6f8fa !important;
    border: 1px solid #d1d5da !important;
    border-radius: 8px !important;
    padding: 6px 12px !important;
    margin-top: 10px !important;
}

.ukm10 span {
    color: #24292f !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: uppercase;
}

/* --- ТЕМНАЯ ТЕМА (body.is-dark-mode) --- */
body.is-dark-mode .bO43I {
    background: #0d0d14 !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
}

body.is-dark-mode .kBzTg {
    color: #ffffff !important;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

body.is-dark-mode .mBqvc span {
    color: #8b8b93 !important;
}

body.is-dark-mode .SIFGw {
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
}

body.is-dark-mode .ukm10 span {
    color: #ffffff !important;
    opacity: 0.9;
}

/* --- СВЕТЛАЯ ТЕМА (Выполнено) --- */
.bO43I.wIzLx {
    background: #f0fff4 !important; /* Очень легкий зеленый оттенок */
    border: 1px solid #00D05A !important;
    box-shadow: 0 4px 12px rgba(0, 208, 90, 0.1) !important;
}

.bO43I.wIzLx .kBzTg {
    color: #008a3c !important;
}

/* --- ТЕМНАЯ ТЕМА (Выполнено) --- */
body.is-dark-mode .bO43I.wIzLx {
    /* Темно-зеленый глубокий градиент */
    background: linear-gradient(145deg, #0a1f12, #0d0d14) !important;
    /* Яркая неоновая граница */
    border: 1px solid rgba(0, 208, 90, 0.4) !important;
    /* Зеленое свечение и внутренняя подсветка */
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(0, 208, 90, 0.1) !important;
    backdrop-filter: blur(10px);
}

body.is-dark-mode .bO43I.wIzLx .kBzTg {
    color: #00ff6e !important;
    text-shadow: 0 0 10px rgba(0, 255, 110, 0.3) !important;
}

body.is-dark-mode .bO43I.wIzLx .mBqvc span {
    color: #a3c7af !important; /* Светло-зеленоватый текст для описания */
}

/* Принудительный цвет для плашек внутри выполненной работы */
body.is-dark-mode .bO43I.wIzLx .SIFGw {
    background: rgba(0, 208, 90, 0.1) !important;
    border-color: rgba(0, 208, 90, 0.2) !important;
}

/* --- СВЕТЛАЯ ТЕМА (Просрочено) --- */
.bO43I.iFg7b {
    background: #fff5f5 !important; /* Нежно-красный фон */
    border: 1px solid #ff4747 !important;
    box-shadow: 0 4px 12px rgba(255, 71, 71, 0.1) !important;
}

.bO43I.iFg7b .kBzTg {
    color: #d32f2f !important; /* Насыщенный красный заголовок */
}

/* --- ТЕМНАЯ ТЕМА (Просрочено) --- */
body.is-dark-mode .bO43I.iFg7b {
    /* Темно-красный глубокий градиент */
    background: linear-gradient(145deg, #2a0a0a, #0d0d14) !important;
    /* Яркая неоновая красная граница */
    border: 1px solid rgba(255, 71, 71, 0.4) !important;
    /* Красное свечение и внутренняя подсветка */
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 71, 71, 0.1) !important;
    backdrop-filter: blur(10px);
}

body.is-dark-mode .bO43I.iFg7b .kBzTg {
    color: #ff5f5f !important;
    text-shadow: 0 0 10px rgba(255, 95, 95, 0.3) !important;
}

body.is-dark-mode .bO43I.iFg7b .mBqvc span {
    color: #f1b0b0 !important; /* Светло-розовый текст для описания дедлайна */
}

/* Цвет плашки внутри просроченной работы */
body.is-dark-mode .bO43I.iFg7b .SIFGw {
    background: rgba(255, 71, 71, 0.1) !important;
    border-color: rgba(255, 71, 71, 0.2) !important;
}

body.is-dark-mode .bO43I.iFg7b .ukm10 span {
    color: #ff8e8e !important;
}

/* --- СТИЛЬ КОЛИЧЕСТВА ДЗ В ДИЗАЙНЕ OUTLINE --- */
.custom-hw-count {
    --card-color: #775AFA; /* Основной фиолетовый цвет для этого стиля */

    position: absolute !important;
    top: 55px !important;
    right: 20px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;

    /* Логика из твоего .badge-outline */
    background: #ffffff !important;
    border: 2px solid var(--card-color) !important;
    color: var(--card-color) !important;
    box-shadow: 0 0 4px var(--card-color) !important;

    padding: 2px 10px !important;
    border-radius: 6px !important;
    font-size: 11px !important;
    font-weight: 800 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    z-index: 15 !important;
    pointer-events: none;
    white-space: nowrap !important;
    animation: slideDownHw 0.3s ease-out forwards;
}

/* --- ТЕМНАЯ ТЕМА (Dark Mode) --- */
body.is-dark-mode .custom-hw-count {
    /* Глубокий темный фон с фиолетовым отливом */
    background: linear-gradient(145deg, rgba(20, 20, 30, 0.9), rgba(10, 10, 15, 0.95)) !important;
    /* Неоновая фиолетовая граница (под стиль 100Points Pro) */
    border: 1px solid rgba(119, 90, 250, 0.4) !important;
    /* Мягкое свечение */
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 8px rgba(119, 90, 250, 0.1) !important;
    /* Яркий текст с небольшим свечением */
    color: #b39dfa !important;
    text-shadow: 0 0 5px rgba(119, 90, 250, 0.4) !important;
}

/* Добавим легкий глоу-эффект при появлении */
@keyframes slideDownHw {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

#hwork-drafts-panel {
    position: fixed;
    top: 70px;
    right: 15px;
    width: 250px;
    background: rgba(13, 13, 20, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(119, 90, 250, 0.4);
    border-radius: 12px;
    z-index: 10000;
    color: #fff;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;

    /* Логика "выплывания" */
    max-height: 40px; /* Высота только заголовка */
    overflow: hidden;
    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

#hwork-drafts-panel:hover {
    max-height: 500px; /* Раскрываем список */
}

.draft-header {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(119, 90, 250, 0.2);
    color: #b39dfa;
    cursor: default;
}

.draft-list {
    max-height: 350px;
    overflow-y: auto;
}

.draft-item {
    padding: 10px 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: 0.2s;
}

.draft-item:hover {
    background: rgba(119, 90, 250, 0.15);
}

.draft-item div {
    font-size: 12px;
    margin-bottom: 2px;
}

.draft-item small {
    font-size: 10px;
    color: #888;
    display: flex;
    justify-content: space-between;
}

.ans-glow { color: #00ffaa; font-weight: bold; }

/* ОБЕРТКА */
.pts-banner-wrapper {
    position: relative !important;
    width: 100%;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* КНОПКА (КРЕСТИК) */
.pts-banner-btn {
    position: absolute !important;
    top: 12px;
    right: 15px;
    width: 28px;
    height: 28px;
    background: rgba(0, 0, 0, 0.4) !important;
    backdrop-filter: blur(5px);
    color: white !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 30;
    font-size: 14px;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    transition: all 0.3s ease;
}

.pts-banner-btn:hover {
    background: #775AFA !important;
    border-color: #775AFA !important;
}

/* ЛОГИКА СВОРАЧИВАНИЯ БАННЕРА */
.pts-banner-checker:checked ~ .DmWLh {
    max-height: 48px !important; /* Высота компактной плашки */
    min-height: 48px !important;
    padding: 0 20px !important;
    margin-bottom: 10px !important;
    background-color: #FFFAFA !important; /* Темный нейтральный фон при скрытии */
    border: 1px solid rgba(119, 90, 250, 0.3) !important;
    opacity: 0.8;
}

/* ЛОГИКА СВОРАЧИВАНИЯ БАННЕРА */
body.is-dark-mode .pts-banner-checker:checked ~ .DmWLh {
    max-height: 48px !important; /* Высота компактной плашки */
    min-height: 48px !important;
    padding: 0 20px !important;
    margin-bottom: 10px !important;
    background-color: #1a1a1a !important; /* Темный нейтральный фон при скрытии */
    border: 1px solid rgba(119, 90, 250, 0.3) !important;
    opacity: 0.1;
}

/* ПЛАВНОЕ ИСЧЕЗНОВЕНИЕ ВНУТРЕННОСТЕЙ */
.DmWLh * {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.pts-banner-checker:checked ~ .DmWLh * {
    opacity: 0 !important;
    pointer-events: none;
    transform: translateY(-5px);
}

/* Текст "Развернуть" вместо пустоты (опционально) */
.pts-banner-checker:checked ~ .DmWLh::after {
    content: 'Баннер оплаты свернут';
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    color: #888;
    font-size: 12px;
    font-weight: 500;
    opacity: 1;
}

/* ПОВОРОТ КРЕСТИКА В ПЛЮСИК */
.pts-banner-checker:checked ~ .pts-banner-btn {
    transform: rotate(45deg);
    background: rgba(119, 90, 250, 0.2) !important;
}

/* ОБЩАЯ АНИМАЦИЯ БАННЕРА */
.DmWLh {
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
    overflow: hidden !important;
    position: relative !important;
}

/* ШАПКА САЙТА (Должна быть сверху) */
.ntGcE {
    z-index: 100 !important;
    position: relative !important;
}

:root {
    --m-x: 50%;
    --m-y: 50%;
}

/* ГРУППА ФОНА: Чистый черный + "Дышащий" блик */
body.is-dark-mode.use-shaders::before {
    content: "";
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: radial-gradient(
        circle at var(--m-x) var(--m-y),
        rgba(119, 90, 250, 0.1) 0%,
        rgba(119, 90, 250, 0.06) 30%,
        transparent 65%
    );
    z-index: -1;
    pointer-events: none;
    transition: background 1.2s cubic-bezier(0.2, 0, 0.3, 1);
}

/* Делаем все фоны прозрачными, чтобы видеть градиент сквойти них на чистый черный */
body.is-dark-mode .qX71Q, .qX71Q[data-theme=dark],
body.is-dark-mode .HcMYw, .HcMYw[data-theme=dark],
body.is-dark-mode .EPKuk, .EPKuk[data-theme=dark],
body.is-dark-mode .GoIVy, .GoIVy[data-theme=dark],
body.is-dark-mode .kexbQ, body.is-dark-mode ._5JBVc,
body.is-dark-mode .OjYDt, body.is-dark-mode .CWqZW,
body.is-dark-mode .ReactMathJaxPreview {
    background-color: transparent !important;
    background-image: none !important;
}

/* Чистый черный цвет для самой подложки сайта */
body.is-dark-mode {
    background-color: #000000 !important;
}

/* ГРУППА СТЕКЛА: Сделал прозрачнее (0.3 вместо 0.6) */
body.is-dark-mode .OIYut,
body.is-dark-mode .dJ46J, body.is-dark-mode .rvN4s,
body.is-dark-mode .TsqGd, .TsqGd[data-theme=dark],
body.is-dark-mode .WDlvs, .dRHLa[data-theme=dark] {
    background: rgba(10, 10, 12, 0.4) !important; /* Полупрозрачная тьма */
    backdrop-filter: blur(40px) saturate(180%) brightness(0.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.05) !important;
}

/* Полностью черный фон body (чтобы не было белых вспышек) */
body.is-dark-mode {
    background-color: #000000 !important;
}

body.is-dark-mode::before {
    display: none !important;
}

/* jrjMP без обводки и максимально чистый */
body.is-dark-mode .jrjMP, .jrjMP[data-theme=dark] {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    backdrop-filter: blur(50px) saturate(200%) brightness(0.7) !important;
}

/* Основной контейнер карточки */
body.is-dark-mode .UAktb[data-theme="dark"] {
    --wrapper-course-bg: #00000000;
    background: rgba(20, 20, 25, 0) !important; /* Очень темное стекло */
    backdrop-filter: blur(25px) saturate(160%) brightness(0.9) !important;
    -webkit-backdrop-filter: blur(25px) saturate(160%) !important;

    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 20px !important; /* Округляем для современного вида */

    /* Тонкий блик сверху и мягкая тень */
    box-shadow:
        inset 0 1px 1px rgba(255, 255, 255, 0.05),
        0 8px 32px rgba(0, 0, 0, 0.4) !important;

    overflow: hidden;
}

/* Эффект при наведении */
body.is-dark-mode .UAktb[data-theme="dark"]:hover {
    background: rgba(30, 30, 35, 0) !important;
    border-color: rgba(119, 90, 250, 0.4) !important; /* Цвет границы становится фиолетовым */
    transform: translateY(-4px);
    box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.6),
        0 0 20px rgba(119, 90, 250, 0.15) !important; /* Мягкое фиолетовое сияние */
}

/* Стилизация прогресс-бара внутри стекла */
body.is-dark-mode .bnDlE[data-theme="dark"] {
    background: rgba(0, 0, 0, 0.3) !important;
    border-radius: 10px !important;
    padding: 8px !important;
}

body.is-dark-mode .DG6Jl {
    background: rgba(255, 255, 255, 0.1) !important; /* Фон полоски */
    height: 6px !important;
    border-radius: 3px !important;
}

body.is-dark-mode .NUfp2 {
    background: linear-gradient(90deg, #775AFA, #9d89ff) !important; /* Градиент прогресса */
    box-shadow: 0 0 10px rgba(119, 90, 250, 0.5) !important;
}

/* Нижняя кнопка "Посмотреть" */
body.is-dark-mode .yOmZn {
    background: rgba(119, 90, 250, 0.1) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
    transition: background 0.3s ease !important;
}

body.is-dark-mode .yOmZn:hover {
    background: rgba(119, 90, 250, 0.2) !important;
}

/* Текст заголовка */
body.is-dark-mode .RQ3YX {
    color: rgba(255, 255, 255, 0.9) !important;
    font-weight: 500 !important;
}

body.is-dark-mode .MXtA_ {
    --cardBodyBorder: #1e1e1f00;
}
    `);

    function updateThemeClass() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.getAttribute('data-theme') === 'dark';
        document.body.classList.toggle('is-dark-mode', isDark);
    }

    function playTimerAlert() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            // Тип звука: 'sine', 'square', 'sawtooth', 'triangle'
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Нота Ля

            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);

            console.log("🔊 Звуковой сигнал таймера сработал");
        } catch (e) {
            console.error("Не удалось воспроизвести звук:", e);
        }
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

function applyHwCountToDOM(count, lessonNode) {
    const hwBadge = lessonNode.querySelector('.custom-hw-count');

    // ЖЕСТКИЙ РУБИЛЬНИК
    if (settings.showHwCount === false) {
        if (hwBadge) hwBadge.style.display = 'none';
        return; // Дальше код не идет, ничего не создается
    }

    if (count === undefined || count === null) return;

    let targetBadge = hwBadge;
    if (!targetBadge) {
        targetBadge = document.createElement('div');
        targetBadge.className = 'custom-hw-count';
        lessonNode.appendChild(targetBadge);
    }

    const text = `ДЗ: ${count}`;
    if (targetBadge.innerText !== text) targetBadge.innerText = text;

    const percentBadge = lessonNode.querySelector('.custom-percent-badge');
    const isBadgeHidden = percentBadge && getComputedStyle(percentBadge).display === 'none';

    targetBadge.style.display = isBadgeHidden ? 'none' : 'inline-flex';
}

    // Функция запроса данных
    function fetchHomeworkCount(lessonId, lessonNode) {
        // Используем уже имеющийся механизм authToken
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.100points.ru/api/student/lessons/${lessonId}/personal`,
            headers: { "Authorization": authToken, "Accept": "application/json" },
            onload: function(res) {
                try {
                    const data = JSON.parse(res.responseText);

                    // Считаем количество домашек в массиве difficulties
                    const hwArray = data.homeworks?.difficulties || [];
                    const count = hwArray.length;

                    // Сохраняем в кэш (дополняем существующий или создаем новый)
                    const cachedData = cache.get(lessonId) || {};
                    cachedData.hwCount = count;
                    cache.set(lessonId, cachedData);

                    // Отрисовываем
                    applyHwCountToDOM(count, lessonNode);
                } catch (e) {
                    console.error("Ошибка при получении количества ДЗ:", e);
                }
            }
        });
    }

function processHomeworkCountLogic(lessonNode) {
// ПРОВЕРКА №1: Если выключено — вообще не заходим в логику
    if (settings.showHwCount === false) {
        return;
    }

    const link = lessonNode.querySelector('a');
    const lessonId = link?.href.match(/lesson\/(\d+)/)?.[1];
    if (!lessonId) return;

    const cached = cache.get(lessonId);
    if (cached && cached.hwCount !== undefined) {
        applyHwCountToDOM(cached.hwCount, lessonNode);
    }

    if (!lessonNode.hasAttribute('data-hw-synced')) {
        if (!cached || cached.hwCount === undefined) {
            lessonNode.setAttribute('data-hw-synced', 'true');
            fetchRealStatus(lessonId, null, lessonNode);
        } else {
            lessonNode.setAttribute('data-hw-synced', 'true');
        }
    }
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
                // ПРОВЕРКА 1: Существует ли еще узел урока в DOM?
                // Если мы ушли на другую страницу, lessonNode станет "осиротевшим"
                if (!lessonNode || !document.contains(lessonNode)) return;

                const data = JSON.parse(res.responseText);
                const difficulties = data.homeworks?.difficulties || [];
                const hw = difficulties[0] || data.homeworks || {};

                let status = hw.student_status || data.student_status;
                const deadline = hw.deadline || data.deadline;
                const isPassed = hw.is_deadline_passed !== undefined ? hw.is_deadline_passed : data.is_deadline_passed;

                if (difficulties.length > 1) {
                    const allDone = difficulties.every(d => d.student_status === 'passed' || d.has_been_passed === true);
                    status = allDone ? 'passed' : 'studying';
                }

                cache.set(lessonId, {
                    status,
                    deadline,
                    is_deadline_passed: isPassed,
                    hwCount: difficulties.length
                });

                // Находим актуальный бейдж
                let currentBadge = badge && document.contains(badge) ? badge : lessonNode.querySelector('.Rjxh7');

                // Проверяем: если статус 'passed', но бейдж УЖЕ зеленый (стандартный),
                // то не вызываем applyStatusToDOM, чтобы не вешать метку (fix)
                const isAlreadyPassed = currentBadge && (
                    currentBadge.classList.contains('Plz9L') || // Класс выполненного урока
                    currentBadge.querySelector('rect[fill="#00D05A"]') // Зеленая иконка
                );

                if (status === 'passed' && isAlreadyPassed) {
                    // Урок и так пройден, просто обновляем кэш и выходим
                    currentBadge.setAttribute('data-checked', 'true');
                } else {
                    // Если есть расхождение или статус другой — применяем фикс/визуал
                    applyStatusToDOM(status, currentBadge, lessonNode, deadline);
                }

                // Количество ДЗ рисуем в любом случае (как ты и просил)
                if (typeof applyHwCountToDOM === 'function') {
                    applyHwCountToDOM(difficulties.length, lessonNode);
                }
            } catch (e) {
                console.error("Ошибка при обработке ответа API:", e);
            }
        }
    });
}

    function getProgressBarStyle(style) {
        let css = '';
        // Основная анимация (нужна для жидкого и пульсации)
        css += `
        @keyframes pts-bar-move { from { background-position: 0 0; } to { background-position: 30px 0; } }
        @keyframes pts-bar-pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
    `;

        switch (style) {
            case 'default':
                return css + `.D0VIa { box-shadow: 0 0 10px currentColor !important; position: relative !important; }
                    .D0VIa::after { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 40%; background: rgba(255,255,255,0.2); }`;

            case 'liquid':
                return css + `.D0VIa { background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%) !important; background-size: 30px 30px !important; animation: pts-bar-move 1s linear infinite !important; }`;

            case 'striped':
                return css + `.D0VIa { background-image: linear-gradient(-45deg, rgba(0,0,0,0.1) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1) 75%, transparent 75%) !important; background-size: 12px 12px !important; }`;

            case 'glow': // Новое: Мягкое внешнее свечение без бликов
                return css + `.D0VIa { filter: drop-shadow(0 0 5px currentColor) !important; }`;

            case 'glass': // Новое: Эффект матового стекла
                return css + `.D0VIa { border: 1px solid rgba(255,255,255,0.3) !important; background-clip: padding-box !important; }
                    .D0VIa::before { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent); }`;

            case 'dots': // Новое: Текстура в крапинку
                return css + `.D0VIa { background-image: radial-gradient(rgba(255,255,255,0.3) 15%, transparent 16%) !important; background-size: 6px 6px !important; }`;

            case 'pulse': // Новое: Плавное мерцание всего бара
                return css + `.D0VIa { animation: pts-bar-pulse 2s ease-in-out infinite !important; box-shadow: 0 0 8px currentColor !important; }`;

            case 'flat-clean': // Новое: Чистый цвет без эффектов
                return css + `.D0VIa { box-shadow: none !important; border-radius: 2px !important; }`;

            case 'dynamic':
            default:
                return css + `.D0VIa { background-image: linear-gradient(to right, rgba(0,0,0,0.05), rgba(255,255,255,0.1)) !important; }`;

            case 'slim': // Новое: Уменьшает высоту бара до тонкой нити по центру
                return css + `
                .D0VIa {
                    height: 4px !important;
                    margin-top: 3px !important;
                    box-shadow: none !important;
                    border-radius: 10px !important;
                }
                .pW0_6 { background: transparent !important; } /* Фон подложки делаем невидимым */
            `;

            case 'segmented': // Новое: Визуально режет бар на мелкие блоки (эффект делений)
                return css + `
                .D0VIa {
                    background-image: linear-gradient(90deg,
                        transparent 0%,
                        transparent 90%,
                        rgba(0,0,0,0.3) 90%,
                        rgba(0,0,0,0.3) 100%
                    ) !important;
                    background-size: 15px 100% !important;
                    box-shadow: none !important;
                }
            `;

            case 'matte': // Новое: Максимально плоский стиль без эффектов
                return css + `
                .D0VIa {
                    box-shadow: none !important;
                    filter: none !important;
                    border: none !important;
                    position: relative !important;
                }
                /* Убираем любые псевдоэлементы-блики, если они были добавлены глобально */
                .D0VIa::after, .D0VIa::before {
                    display: none !important;
                }
            `;
        }
    }

    function updateDynamicStyles() {
        const old = document.getElementById('pts-dynamic-css');
        if (old) old.remove();

        let css = '';
        const cardScale = (settings.cardPadding || 100) / 100;

        // --- 1. ПРИМЕНЕНИЕ CSS ПЕРЕМЕННЫХ К ROOT ---
        const root = document.documentElement;
        root.style.setProperty('--task-btn-size', `${settings.taskBtnSize || 40}px`);
        root.style.setProperty('--task-btn-radius', `${settings.taskBtnRadius || 50}%`);
        root.style.setProperty('--badge-size', `${settings.badgeSize || 12}px`);
        root.style.setProperty('--card-pad', `${settings.cardInnerPadding || 15}px`);
        root.style.setProperty('--card-rad', `${settings.cardBorderRadius || 20}px`);

        // --- 2. БАЗОВАЯ ГЕОМЕТРИЯ И МАСШТАБ ---
        css += `
        .mUkKn {
            zoom: ${cardScale} !important;
            transform-origin: top center !important;
            padding: var(--card-pad) !important;
            border-radius: var(--card-rad) !important;
            overflow: hidden !important;
            transition: all 0.3s ease !important;
            -webkit-font-smoothing: antialiased;
        }
        .mUkKn, .mUkKn * { font-size: ${settings.fontSize}px !important; }
        .Hlt15 {
            width: var(--task-btn-size) !important;
            height: var(--task-btn-size) !important;
            min-width: var(--task-btn-size) !important;
            border-radius: var(--task-btn-radius) !important;
            display: flex !important; align-items: center !important; justify-content: center !important;
        }
        .dUBAa, .DLW6Q, .ovZ4y, [class*="status"], [class*="badge"] { font-size: var(--badge-size) !important; }
        .custom-timer-container { display: ${settings.showCustomTimer !== false ? 'block' : 'none'} !important; }
    `;

        // --- 3. ШРИФТЫ (Включая тонкие) ---
        const thinFonts = ['Inter', 'Raleway', 'Exo 2', 'Quicksand', 'Work Sans', 'Titillium Web', 'Kanit', 'Source Code Pro', 'Roboto'];
        const fontWeight = thinFonts.includes(settings.fontStyle) ? '300' : '700';

        if (settings.fontStyle && settings.fontStyle !== 'default') {
            css += `
            .mUkKn, .mUkKn div, .mUkKn span, .mUkKn a, .mUkKn h1, .mUkKn h2, .mUkKn h3, .mUkKn p, .mUkKn button, .Hlt15 {
                font-family: '${settings.fontStyle}', sans-serif !important;
                font-weight: ${fontWeight} !important;
            }
        `;
        }

        // --- 4. ЛОГИКА АНИМАЦИЙ ---
        if (settings.hoverAnim === 'lift') {
            css += `.mUkKn:hover { transform: translateY(-8px) !important; }`;
        } else if (settings.hoverAnim === 'scale') {
            css += `.mUkKn:hover { transform: scale(1.03) !important; }`;
        } else if (settings.hoverAnim === 'glow') {
            css += `.mUkKn:hover { box-shadow: 0 10px 30px rgba(119, 90, 250, 0.3) !important; }`;
        } else if (settings.hoverAnim === 'float') {
            css += `@keyframes pts-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                .mUkKn:hover { animation: pts-float 2s ease-in-out infinite !important; }`;
        }

        switch (settings.cardStyle) {
            case 'pure-white':
                css += `
                    .mUkKn { background: #fff !important; border: none !important; box-shadow: 0 4px 20px rgba(0,0,0,0.05) !important; }
                    body.is-dark-mode .mUkKn { background: #1a1a1a !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; }
                `; break;

            case 'glass-deep':
                css += `
                    .mUkKn {
                        background: rgba(255, 255, 255, 0.6) !important;
                        backdrop-filter: blur(20px) saturate(160%) !important;
                        border: 1px solid rgba(255, 255, 255, 0.4) !important;
                    }
                    body.is-dark-mode .mUkKn {
                        background: rgba(15, 15, 20, 0.4) !important;
                        border: 1px solid rgba(255, 255, 255, 0.08) !important;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05) !important;
                    }
                `; break;

            case 'border-thin':
                css += `
                    .mUkKn { background: #fff !important; border: 1.5px solid #f0f0f5 !important; }
                    body.is-dark-mode .mUkKn { background: #121212 !important; border: 1.2px solid #2a2a2a !important; }
                `; break;

            case 'soft-blue':
                css += `
                    .mUkKn { background: #f8faff !important; border: 1px solid #eef2ff !important; }
                    body.is-dark-mode .mUkKn { background: #11141d !important; border: 1px solid #1e253a !important; }
                `; break;

            case 'neon-border':
                css += `
                    .mUkKn { background: #fff !important; border: 1.5px solid #775AFA !important; box-shadow: 0 0 10px rgba(119, 90, 250, 0.2) !important; }
                    body.is-dark-mode .mUkKn { background: #0a0a0a !important; border: 1.5px solid #775AFA !important; box-shadow: 0 0 15px rgba(119, 90, 250, 0.4) !important; }
                `; break;

            case 'cyber-clean':
                css += `
                    .mUkKn { background: #fff !important; border-left: 4px solid #775AFA !important; border-bottom: 4px solid #eee !important; }
                    body.is-dark-mode .mUkKn { background: #151515 !important; border-left: 4px solid #775AFA !important; border-bottom: 4px solid #222 !important; border-right: 1px solid #222 !important; }
                `; break;

            case 'floating':
                css += `
                    .mUkKn { background: #fff !important; box-shadow: 0 15px 35px rgba(0,0,0,0.05) !important; }
                    body.is-dark-mode .mUkKn { background: #1c1c1c !important; box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important; }
                `; break;

            case 'neu-flat':
                css += `
                    .mUkKn { background: #f0f2f5 !important; box-shadow: 6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff !important; }
                    body.is-dark-mode .mUkKn { background: #1a1a1a !important; box-shadow: 6px 6px 12px #0a0a0a, -4px -4px 10px #2a2a2a !important; border: none !important; }
                `; break;

            case 'dot-grid':
                css += `
                    .mUkKn { background: #fff !important; background-image: radial-gradient(#e5e7eb 1px, transparent 1px) !important; background-size: 15px 15px !important; }
                    body.is-dark-mode .mUkKn { background: #111 !important; background-image: radial-gradient(#333 1px, transparent 1px) !important; background-size: 15px 15px !important; }
                `; break;

            case 'royal-gold':
                css += `
                    .mUkKn { background: #fff !important; border: 1px solid #f3e5ab !important; }
                    body.is-dark-mode .mUkKn { background: #12110a !important; border: 1px solid #4a3f1a !important; box-shadow: 0 0 15px rgba(243, 229, 171, 0.1) !important; }
                `; break;

            case 'pearl':
                css += `
                    .mUkKn { background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%) !important; }
                    body.is-dark-mode .mUkKn { background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%) !important; }
                `; break;

            case 'clay':
                css += `
                    .mUkKn { background: #fff !important; box-shadow: inset 4px 4px 8px #f0f2f5, 0 12px 24px -8px rgba(0,0,0,0.1) !important; }
                    body.is-dark-mode .mUkKn { background: #222 !important; box-shadow: inset 4px 4px 8px #1a1a1a, 0 12px 24px -8px rgba(0,0,0,0.5) !important; border: none !important; }
                `; break;

            case 'notebook-line':
                css += `
                    .mUkKn { background: #fff !important; background-image: linear-gradient(#f0f0f0 1px, transparent 1px) !important; background-size: 100% 2.5em !important; border-left: 2px solid #ffadad !important; }
                    body.is-dark-mode .mUkKn { background: #1a1a17 !important; background-image: linear-gradient(#252520 1px, transparent 1px) !important; border-left: 2px solid #804040 !important; }
                `; break;

            case 'blueprint':
                css += `
                    .mUkKn { background-color: #f0f7ff !important; background-image: linear-gradient(rgba(119, 90, 250, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(119, 90, 250, 0.1) 1px, transparent 1px) !important; border: 2px solid #775AFA !important; }
                    body.is-dark-mode .mUkKn { background-color: #050a1a !important; background-image: linear-gradient(rgba(119, 90, 250, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(119, 90, 250, 0.2) 1px, transparent 1px) !important; border: 2px solid #3d2b8f !important; }
                `; break;

            case 'sticky-note':
                css += `
                    .mUkKn { background: #fff9c4 !important; color: #444 !important; }
                    body.is-dark-mode .mUkKn { background: #3d3b25 !important; color: #eee !important; border: none !important; }
                `; break;

            case 'graph-paper':
                css += `
                    .mUkKn { background: #fff !important; background-image: linear-gradient(#e0e0e0 1px, transparent 1px), linear-gradient(90deg, #e0e0e0 1px, transparent 1px) !important; }
                    body.is-dark-mode .mUkKn { background: #111 !important; background-image: linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px) !important; border: 1px solid #333 !important; }
                `; break;

            case 'clipboard':
                css += `
                    .mUkKn { background: #fff !important; border-top: 15px solid #d1d5db !important; }
                    body.is-dark-mode .mUkKn { background: #1a1a1a !important; border-top: 15px solid #333 !important; border: 1px solid #333; }
                `; break;
        }

        css += getProgressBarStyle(settings.barStyle);

        css += `@keyframes pts-bar-move { from { background-position: 0 0; } to { background-position: 30px 0; } }`;

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
        <h2 style="margin-bottom: 15px; text-align: center; border-bottom: 2px solid #775AFA; padding-bottom: 10px;">100Points Pro</h2>

        <div class="menu-group-title">🗂 Карточки и Текст</div>

        <div class="menu-section">
            <label>Стиль обложки</label>
            <select class="pts-select" data-setting="cardStyle">
                ${cardStyles.map(s => `<option value="${s.id}" ${settings.cardStyle === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
        </div>

        <div class="menu-section">
                <label>Масштаб карточек: <span id="card-val">${settings.cardPadding}</span>%</label>
                <input type="range" class="pts-range" data-setting="cardPadding" min="70" max="130" value="${settings.cardPadding}">
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
        ${barStyles.map(s => `<option value="${s.id}" ${settings.barStyle === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
</div>

        <div class="menu-section">
            <label>Внутренний отступ: <span id="pad-val">${settings.cardInnerPadding || 15}</span>px</label>
            <input type="range" class="pts-range" data-setting="cardInnerPadding" min="0" max="40" value="${settings.cardInnerPadding || 15}">
        </div>

        <div class="menu-section">
            <label>Скругление углов: <span id="rad-val">${settings.cardBorderRadius || 20}</span>px</label>
            <input type="range" class="pts-range" data-setting="cardBorderRadius" min="0" max="50" value="${settings.cardBorderRadius || 20}">
        </div>

        <div class="menu-section">
            <label>Размер меток статуса: <span id="badge-size-val">${settings.badgeSize || 12}</span>px</label>
            <input type="range" class="pts-range" data-setting="badgeSize" min="8" max="24" value="${settings.badgeSize || 12}">
        </div>

        <div class="menu-section">
            <label>Шрифт заголовков</label>
            <select class="pts-select" data-setting="fontStyle">
                ${fontStyles.map(f => `<option value="${f.id}" ${settings.fontStyle === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
        </div>

        <div class="menu-section">
            <label>Размер текста: <span id="font-val">${settings.fontSize}</span>px</label>
            <input type="range" class="pts-range" data-setting="fontSize" min="10" max="24" value="${settings.fontSize}">
        </div>

        <div class="menu-section">
            <label>Анимация при наведении</label>
            <select class="pts-select" data-setting="hoverAnim">
                ${hoverAnimations.map(a => `<option value="${a.id}" ${settings.hoverAnim === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
        </div>

        <div class="menu-section">
    <div class="menu-checkbox-section">
        <label>Отображать количество ДЗ</label>
        <input type="checkbox" class="pts-checkbox" data-setting="showHwCount" ${settings.showHwCount !== false ? 'checked' : ''}>
    </div>
</div>

        <hr class="menu-divider">

        <div class="menu-group-title">📝 Задания (ДЗ)</div>

        <div class="menu-section">
            <label>Размер кнопок номеров: <span id="task-size-val">${settings.taskBtnSize || 40}</span>px</label>
            <input type="range" class="pts-range" data-setting="taskBtnSize" min="25" max="120" value="${settings.taskBtnSize || 40}">
        </div>

        <div class="menu-section">
            <label>Скругление номеров: <span id="task-rad-val">${settings.taskBtnRadius || 50}</span>%</label>
            <input type="range" class="pts-range" data-setting="taskBtnRadius" min="0" max="50" value="${settings.taskBtnRadius || 50}">
        </div>

        <div class="menu-section">
            <div class="menu-checkbox-section">
                <label>🔔 Умный таймер и звуки</label>
                <input type="checkbox" class="pts-checkbox" data-setting="showCustomTimer" ${settings.showCustomTimer !== false ? 'checked' : ''}>
            </div>
        </div>

        <hr class="menu-divider">

        <div class="menu-group-title">🛠 Инструменты</div>

        <div class="menu-section">
            <div class="menu-checkbox-section">
                <label>Ресайз видео</label>
                <input type="checkbox" class="pts-checkbox" data-setting="videoResizer" ${settings.videoResizer ? 'checked' : ''}>
            </div>
        </div>

        <div class="menu-section">
            <div class="menu-checkbox-section">
                <label>Кнопка захвата (📸)</label>
                <input type="checkbox" class="pts-checkbox" data-setting="showCaptureBtn" ${settings.showCaptureBtn ? 'checked' : ''}>
            </div>
            <div class="menu-checkbox-section">
                <label>Кнопка "Скачать всё" (📥)</label>
                <input type="checkbox" class="pts-checkbox" data-setting="showMassCaptureBtn" ${settings.showMassCaptureBtn ? 'checked' : ''}>
            </div>
            <div class="menu-checkbox-section">
                <label>Кнопка закрытия чата (✕)</label>
                <input type="checkbox" class="pts-checkbox" data-setting="showChatCloseBtn" ${settings.showChatCloseBtn ? 'checked' : ''}>
            </div>

            <div class="menu-checkbox-section">
    <label>У меня тянет Майнкрафт с шейдерами</label>
    <input type="checkbox" class="pts-checkbox" data-setting="useShaders" ${settings.useShaders ? 'checked' : ''}>
            </div>

            <div class="menu-checkbox-section">
                <label>Убрать дрисню</label>
                <input type="checkbox" class="pts-checkbox" data-setting="cleanMode" ${settings.cleanMode ? 'checked' : ''}>
            </div>

        </div>

        <button id="pts-close">Готово</button>
    `;
        document.body.appendChild(menu);

        // Логика открытия/закрытия
        btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
        document.getElementById('pts-close').onclick = () => menu.classList.remove('open');

        // Универсальный обработчик изменений
        menu.querySelectorAll('.pts-select, .pts-range, .pts-checkbox').forEach(el => {
            const updateAll = () => {
                const key = el.dataset.setting;
                let val = el.type === 'checkbox' ? el.checked : el.value;

                if (el.type === 'range') {
                    val = parseInt(val);

                    // Динамическое обновление текста рядом с ползунком
                    const displayMap = {
                        'cardPadding': 'card-val',
                        'fontSize': 'font-val',
                        'cardInnerPadding': 'pad-val',
                        'cardBorderRadius': 'rad-val',
                        'taskBtnSize': 'task-size-val',
                        'taskBtnRadius': 'task-rad-val',
                        'badgeSize': 'badge-size-val'
                    };
                    if (displayMap[key]) document.getElementById(displayMap[key]).innerText = val;
                }

                settings[key] = val;
                saveSettings();

                // Применяем изменения мгновенно
                updateDynamicStyles();
                if (window.updateChatControl) updateChatControl();

                if (key === 'showHwCount') {
                    settings.showHwCount = val;
                    saveSettings();

                    // Прячем или удаляем плашки принудительно
                    document.querySelectorAll('.custom-hw-count').forEach(el => {
                        el.style.display = 'none'; // Скрываем
                        // el.remove(); // Можно даже удалять, если хочешь полной очистки
                    });

                    console.log(`[Fix] Видимость ДЗ переключена: ${val}`);
                }

                // Если выключили таймер — удаляем наш блок
                if (key === 'showCustomTimer' && !val) {
                    const myT = document.getElementById('custom-timer-display');
                    if (myT) myT.closest('.custom-timer-container').remove();
                }
            };

            // В самом конце createMenu
            el.onchange = updateAll; // Оставляем только onchange, он надежнее для чекбоксов

            // Если это ползунок, оставляем oninput для живого обновления цифр
            if (el.type === 'range') {
                el.oninput = updateAll;
            }
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

    const lessonData = cache.get(lessonId);
    const progressBar = lesson.querySelector('.D0VIa');

    // Определяем наличие прогресс-бара и значение
    const hasProgressBar = !!progressBar;
    const p = hasProgressBar ? (parseInt(progressBar.style.width) || 0) : 0;

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

    let badgeText = '';
    let badgeColor = finalColor;
    let isUrgent = false;

    // --- 1. ВЫСШИЙ ПРИОРЕТЕТ: ПРОГРЕСС-БАР ---
    // Если на странице физически есть полоска прогресса, показываем проценты (даже 0%)
    if (hasProgressBar) {
        badgeText = p + '%';
        badgeColor = finalColor;
    }

    // --- 2. ВТОРОЙ ПРИОРЕТЕТ: ДЕДЛАЙНЫ (только если нет прогресс-бара) ---
    else if (lessonData && !lessonData.is_deadline_passed && lessonData.deadline) {
        const parts = lessonData.deadline.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (parts) {
            const dDate = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T23:59:59`);
            const diff = dDate - new Date();
            if (diff > 0) {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                badgeText = `${d}д ${h}ч`;
                isUrgent = (d < 2);
                badgeColor = isUrgent ? '#FF4747' : '#775AFA';
            }
        }
    }

    // --- 3. ТРЕТИЙ ПРИОРЕТЕТ: СТАТУС "НА ПРОВЕРКЕ" ---
    if (!badgeText && lessonData && lessonData.status === 'checking') {
        badgeText = '——';
        badgeColor = '#FFA500';
    }

    // --- 4. ФИНАЛЬНЫЙ ФОЛЛБЕК ---
    if (!badgeText) {
        badgeText = '——';
        badgeColor = '#8e74ff';
    }

    // --- ОТРИСОВКА ---
    pbBadge.innerText = badgeText;
    pbBadge.style.display = 'block';
    pbBadge.style.setProperty('--card-color', badgeColor, 'important');

    const allStyles = ['badge-outline', 'badge-glass', 'badge-cyber', 'badge-minimal'];
    pbBadge.classList.remove(...allStyles);

    if (settings.badgeStyle && settings.badgeStyle !== 'flat') {
        pbBadge.classList.add('badge-' + settings.badgeStyle);
    } else {
        pbBadge.style.setProperty('background', badgeColor, 'important');
        pbBadge.style.setProperty('color', 'white', 'important');
    }

    pbBadge.classList.toggle('deadline-urgent', isUrgent);

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

    let applyTimeout;
    function debouncedApplyLogic() {
        clearTimeout(applyTimeout);
        applyTimeout = setTimeout(() => {
            applyLogic();
        }, 300);
    }

    function applyLogic() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            retryCount.clear();
            document.querySelectorAll('[data-checked]').forEach(el => el.removeAttribute('data-checked'));
        }

        // --- ОБРАБОТКА УРОКОВ ---
        document.querySelectorAll('.mUkKn').forEach(lesson => {
            // Сначала запускаем логику количества ДЗ — она теперь безусловная
            if (settings.showHwCount === true) processHomeworkCountLogic(lesson);

            processVisuals(lesson);

            const badge = lesson.querySelector('.Rjxh7');
            if (!badge) return;

            if (badge.classList.contains('Plz9L') && !badge.hasAttribute('data-checked')) return;
            processStatusLogic(lesson, badge);
        });
    }

    window.addEventListener('scroll', debouncedApplyLogic, {passive: true});
    document.addEventListener('click', () => debouncedApplyLogic);
    new MutationObserver(updateThemeClass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    updateThemeClass();

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
                allowTaint : false,
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


    // Вспомогательная функция для глубокой подготовки медиа перед захватом
    async function preloadImages(element) {
        const imgs = Array.from(element.querySelectorAll('img'));
        const promises = imgs.map(img => {
            return new Promise((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                    resolve();
                } else {
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // Игнорируем битые, чтобы не вешать процесс
                }
            });
        });
        // Также обрабатываем фоновые изображения, если они есть
        return Promise.all(promises);
    }

    async function downloadAllHomework(btn) {
        const taskButtons = document.querySelectorAll('.Hlt15'); // Кнопки номеров задач
        if (taskButtons.length === 0) return;

        const originalActive = document.querySelector('.Hlt15.HqV_y'); // Запоминаем текущую
        btn.disabled = true;
        btn.innerText = '⌛ Загрузка...';

        for (let i = 0; i < taskButtons.length; i++) {
            const tBtn = taskButtons[i];
            tBtn.click(); // Переключаем задачу

            btn.innerText = `📸 Задание ${i + 1}/${taskButtons.length}`;

            // Ждем подгрузки контента (простая проверка по времени и наличию текста)
            await new Promise(resolve => {
                let checks = 0;
                const interval = setInterval(() => {
                    const content = document.querySelector('.ck-content');
                    if ((content && content.innerText.length > 10) || checks > 20) {
                        clearInterval(interval);
                        setTimeout(resolve, 600); // Небольшая пауза для отрисовки
                    }
                    checks++;
                }, 100);
            });

            const taskElement = document.querySelector('.dJ46J');
            await silentTaskCapture(taskElement);
        }

        // Возвращаемся в начало
        if (originalActive) originalActive.click();
        btn.disabled = false;
        btn.innerText = '✅ Готово!';
        setTimeout(() => { btn.innerText = '📥 Скачать всё (PNG)'; }, 3000);
    }

    async function silentTaskCapture(taskElement) {
        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

            const canvas = await html2canvas(taskElement, {
                backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                scale: 2,
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    // РЕШЕНИЕ ИЗ ИНТЕРНЕТА:
                    // Вместо удаления или display:none, ставим прозрачность в 0
                    const assistive = clonedDoc.querySelectorAll('mjx-assistive-mml');
                    assistive.forEach(el => {
                        el.style.setProperty('display', 'none', 'important');
                        el.style.setProperty('opacity', '0', 'important');
                        el.style.setProperty('position', 'absolute', 'important');
                        el.style.setProperty('pointer-events', 'none', 'important');
                    });

                    // Также скрываем саму кнопку скачивания в клоне
                    const btnInTask = clonedDoc.querySelector('.download-task-btn');
                    if (btnInTask) btnInTask.style.display = 'none';
                }
            });

            const link = document.createElement('a');
            const taskName = taskElement.querySelector('.XZTcz')?.innerText || 'Task';
            link.download = `${taskName.replace(/[^a-zа-я0-9]/gi, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

        } catch (e) {
            console.error("Ошибка при захвате:", e);
        }
    }

    //ЛОГИКА ДЛЯ БАННЕРА

    let tabsRemovalStartTime = null; // Переменная для хранения времени появления шапки

    // Внутри setInterval
    const header = document.querySelector('.ntGcE');
    const tabs = document.querySelector('.TsqGd');

    // Исправленная функция баннера (с защитой от insertBefore error)
    function initBannerToggle() {
        const banner = document.querySelector('.DmWLh:not(.banner-processed)');
        if (!banner || !banner.parentNode) return; // Проверка parentNode критична

        banner.classList.add('banner-processed');
        const wrapper = document.createElement('div');
        wrapper.className = 'pts-banner-wrapper';

        // Безопасная вставка
        const parent = banner.parentNode;
        if (parent) {
            parent.insertBefore(wrapper, banner);
            wrapper.innerHTML = `
            <input type="checkbox" id="pts-banner-toggle" hidden="true" class="pts-banner-checker">
            <label for="pts-banner-toggle" class="pts-banner-btn" title="Свернуть/Развернуть">✕</label>
        `;
            wrapper.appendChild(banner);
        }
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
        const videoContainer = document.querySelector('.gDPOa');
        const parentWrapper = document.querySelector('.wCNrd');

        // Если настройка выключена — вызываем сброс и выходим
        if (!settings.videoResizer) {
            resetVideoAndChat();
            return;
        }

        if (!videoContainer || !parentWrapper) return;

        // Гарантируем правильную структуру для работы ресайза
        parentWrapper.style.display = 'flex';
        parentWrapper.style.flexDirection = 'row';
        parentWrapper.style.alignItems = 'stretch';

        let handle = videoContainer.querySelector('.video-resizer-handle');
        if (!handle) {
            handle = document.createElement('div');
            handle.className = 'video-resizer-handle';
            videoContainer.appendChild(handle);
            setupResizerEvents(videoContainer, handle);
        }
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

    // 1. Функция ГЛУБОКОГО сброса
    function resetVideoAndChat() {
        console.log("Удаление инструментов ресайза (сохранение структуры)");
        const handle = document.querySelector('.video-resizer-handle');

        // Удаляем только ручку, чтобы нельзя было менять размер
        if (handle) {
            handle.remove();
        }

        // Мы НЕ удаляем стили у parentWrapper и видео,
        // чтобы чат не сползал вниз и сохранял текущий размер
    }

    // 2. Улучшенное управление кнопкой и состоянием
    function updateChatControl() {
        const chatContainer = document.querySelector('.vqMgR');
        const parentWrapper = document.querySelector('.wCNrd'); // Общий родитель видео и чата

        if (!chatContainer || !parentWrapper) return;

        let closeBtn = document.querySelector('.chat-close-btn');

        if (!settings.showChatCloseBtn) {
            if (closeBtn) closeBtn.remove();
            return;
        }

        if (!closeBtn) {
            console.log("Создаю кнопку поверх всех элементов");
            closeBtn = document.createElement('button');
            closeBtn.className = 'chat-close-btn';
            closeBtn.innerText = 'Скрыть чат ✕';

            // Стилизуем кнопку так, чтобы она была ВСЕГДА видна в углу родителя
            Object.assign(closeBtn.style, {
                position: 'absolute',
                zIndex: '2147483647', // Максимальный z-index
                top: '10px',
                right: '10px',
                padding: '8px 15px',
                background: '#6161FC',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'block'
            });

            closeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isHidden = chatContainer.style.display === 'none';

                if (!isHidden) {
                    // СКРЫВАЕМ
                    resetVideoAndChat(); // Твоя функция сброса ресайза
                    chatContainer.style.setProperty('display', 'none', 'important');

                    const video = parentWrapper.querySelector('.gDPOa');
                    if (video) {
                        video.style.setProperty('width', '100%', 'important');
                        video.style.setProperty('max-width', '100%', 'important');
                        video.style.setProperty('height', 'auto', 'important');
                    }
                    closeBtn.innerText = 'Показать чат 👁';
                } else {
                    // ПОКАЗЫВАЕМ
                    chatContainer.style.setProperty('display', 'flex', 'important');
                    const video = parentWrapper.querySelector('.gDPOa');
                    if (video) video.style.width = ''; // Возвращаем авто-ширину сайта

                    closeBtn.innerText = 'Скрыть чат ✕';
                }
            };

            // ВАЖНО: Добавляем в parentWrapper, а не в chatContainer
            parentWrapper.style.position = 'relative'; // Чтобы absolute работал корректно
            parentWrapper.appendChild(closeBtn);
        }
    }

    // В функции setupResizerEvents ничего менять не нужно,
    // но убедись, что она не создает дубликаты ручек.

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

    async function prepareMediaForScreenshot(element) {
        const images = element.querySelectorAll('img');
        const promises = Array.from(images).map(img => {
            return new Promise((resolve) => {
                if (img.src.startsWith('data:')) return resolve(); // Уже сконвертировано

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const newImg = new Image();

                newImg.crossOrigin = 'Anonymous'; // Обход CORS
                newImg.src = img.src;

                newImg.onload = () => {
                    canvas.width = newImg.width;
                    canvas.height = newImg.height;
                    ctx.drawImage(newImg, 0, 0);
                    try {
                        img.src = canvas.toDataURL('image/png');
                    } catch (e) {
                        console.error("Ошибка конвертации медиа:", e);
                    }
                    resolve();
                };

                newImg.onerror = resolve; // Если не загрузилось, идем дальше
            });
        });

        await Promise.all(promises);
    }

    // Переменные для контроля (вне интервала)
    let timerDataCaptured = false;
    let lastActiveId = null;

    function handlePersistentTimer() {
        const oldTimer = document.querySelector('.swNXM');
        const lessonId = window.location.pathname.match(/\d+/)?.[0];

        if (!lessonId || !oldTimer) return;

        const finishKey = `timer_finish_${lessonId}`;
        const startKey = `timer_start_${lessonId}`;

        let savedEndTime = localStorage.getItem(finishKey);
        let savedStartTime = localStorage.getItem(startKey);

        // 1. Инициализация (парсинг оригинала при первом запуске)
        if (!savedEndTime) {
            const timeText = oldTimer.querySelector('.ovZ4y')?.innerText;
            const match = timeText?.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (match) {
                const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
                savedEndTime = (Date.now() + (seconds * 1000)).toString();
                savedStartTime = Date.now().toString();

                localStorage.setItem(finishKey, savedEndTime);
                localStorage.setItem(startKey, savedStartTime);
            } else return;
        }

        // 2. Создание или поиск нашего интерфейса
        let myTimerDisplay = document.getElementById('custom-timer-display');
        let myStartDisplay = document.getElementById('custom-timer-start-time');

        if (!myTimerDisplay) {
            const container = document.createElement('div');
            container.className = 'custom-timer-container';
            container.innerHTML = `
            <div class="custom-timer-content">
                <div class="custom-timer-main">
                    <span class="custom-timer-label">Осталось:</span>
                    <span class="custom-timer-value" id="custom-timer-display">--:--:--</span>
                </div>
                <div class="custom-timer-started">Начат в: <span id="custom-timer-start-time">--:--</span></div>
            </div>
        `;
        // Скрываем оригинал, чтобы не мешал, и ставим свой
        oldTimer.style.display = 'none';
        if (!oldTimer.parentNode.querySelector('.custom-timer-container')) {
            oldTimer.after(container);
        }
        myTimerDisplay = document.getElementById('custom-timer-display');
        myStartDisplay = document.getElementById('custom-timer-start-time');
    }

    // 3. Обновление цифр
    if (myTimerDisplay && savedEndTime) {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((parseInt(savedEndTime) - now) / 1000));

        // Вывод "Начат в" (HH:MM)
        if (myStartDisplay && savedStartTime && myStartDisplay.innerText === '--:--') {
            const startDate = new Date(parseInt(savedStartTime));
            myStartDisplay.innerText = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        }

        // --- ЛОГИКА ЗВУКОВЫХ УВЕДОМЛЕНИЙ ---
        const checkAlert = (thresholdSec, label) => {
            const alertKey = `alert_${label}_${lessonId}`;
            //timeLeft — это секунды, которые мы посчитали выше
            if (timeLeft <= thresholdSec && timeLeft > thresholdSec - 5 && !localStorage.getItem(alertKey)) {
                playTimerAlert();
                localStorage.setItem(alertKey, 'true');
            }
        };

        checkAlert(3600, '1h');
        checkAlert(1800, '30m');
        checkAlert(600, '10m');

        // Отрисовка оставшегося времени
        const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        myTimerDisplay.innerText = `${h}:${m}:${s}`;

        // Красный цвет, если осталось мало времени
        if (timeLeft < 600) {
            myTimerDisplay.classList.add('timer-low');
        } else {
            myTimerDisplay.classList.remove('timer-low');
        }
    }
}


    function applyCleanMode() {
        if (!settings.cleanMode) return;

        // Прячем всё лишнее через CSS, чтобы не нагружать процессор
        const selectors = [
            '.banner-container.ambassador-banner',
            '.dJ46J.ub6AZ.UbmX3.has-capture-btn',
            '.zhG_D',
            '.D3HJO',
            '._Nrsa'
        ];

        selectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.style.setProperty('display', 'none', 'important');
        });
    }

    function centerActiveTask() {
        const activeBtn = document.querySelector('.Hlt15.HqV_y');
        const container = document.querySelector('.QblpJ');
        const downloadBtn = document.querySelector('.download-all-tasks-btn');
        const mainWrapper = document.querySelector('._9kveE');

        if (!container || !activeBtn) return;

        // 1. Центрируем только цепочку номеров
        const btnRect = activeBtn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);

        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });

        // 2. Добавляем кнопку ОДИН РАЗ прямо в подложку, если её там нет
        if (downloadBtn && mainWrapper && downloadBtn.parentNode !== mainWrapper) {
            mainWrapper.appendChild(downloadBtn);
        }
    }

function updateDraftsUI() {
    let panel = document.getElementById('hwork-drafts-panel');
    const match = window.location.href.match(/homework\/(\d+)/);
    const currentHwId = match ? match[1] : null;

    if (!currentHwId) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'hwork-drafts-panel';
        // Добавляем инлайновые стили для мягкости
        panel.style.transition = 'transform 0.1s ease-out, opacity 0.3s ease';
        panel.innerHTML = `<div class="draft-header" style="cursor: grab; user-select: none;">⬇ Черновики ДЗ</div><div class="draft-list"></div>`;
        document.body.appendChild(panel);

        // --- ФИЗИКА, ИНЕРЦИЯ И ГРАНИЦЫ ---
        const header = panel.querySelector('.draft-header');
        let isDragging = false;
        let vx = 0, vy = 0;
        let lastMouseX, lastMouseY;
        let rafId = null;

        const physicsLoop = () => {
            if (isDragging) return;

            vx *= 0.98;
            vy *= 0.98;

            if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
                let currX = parseFloat(panel.dataset.posX || panel.offsetLeft);
                let currY = parseFloat(panel.dataset.posY || panel.offsetTop);

                let nextX = currX + vx;
                let nextY = currY + vy;

                // ОТСКОК ПРИ ИНЕРЦИИ
                const padding = 5;
                if (nextX < padding) { nextX = padding; vx *= -0.5; }
                if (nextY < padding) { nextY = padding; vy *= -0.5; }
                if (nextX > window.innerWidth - panel.offsetWidth - padding) {
                    nextX = window.innerWidth - panel.offsetWidth - padding;
                    vx *= -0.5;
                }
                if (nextY > window.innerHeight - panel.offsetHeight - padding) {
                    nextY = window.innerHeight - panel.offsetHeight - padding;
                    vy *= -0.5;
                }

                panel.style.left = nextX + 'px';
                panel.style.top = nextY + 'px';
                panel.dataset.posX = nextX;
                panel.dataset.posY = nextY;

                rafId = requestAnimationFrame(physicsLoop);
            } else {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };

        header.onmousedown = (e) => {
            isDragging = true;
            if (rafId) cancelAnimationFrame(rafId);

            panel.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.3s ease';
            panel.style.transform = 'scale(1.05) rotate(1deg)';
            panel.style.opacity = '0.85';
            header.style.cursor = 'grabbing';

            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            let offsetX = e.clientX - panel.offsetLeft;
            let offsetY = e.clientY - panel.offsetTop;

            const onMouseMove = (e) => {
                vx = e.clientX - lastMouseX;
                vy = e.clientY - lastMouseY;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;

                let targetX = e.clientX - offsetX;
                let targetY = e.clientY - offsetY;

                // ЖЕСТКИЙ УДАР ОБ КРАЯ ПРИ ПЕРЕНОСЕ
                const minX = 0;
                const minY = 0;
                const maxX = window.innerWidth - panel.offsetWidth;
                const maxY = window.innerHeight - panel.offsetHeight;

                // Ограничиваем координаты (Clamp)
                if (targetX < minX) targetX = minX;
                if (targetX > maxX) targetX = maxX;
                if (targetY < minY) targetY = minY;
                if (targetY > maxY) targetY = maxY;

                panel.style.left = targetX + 'px';
                panel.style.top = targetY + 'px';
                panel.dataset.posX = targetX;
                panel.dataset.posY = targetY;
            };

            const onMouseUp = () => {
                isDragging = false;
                panel.style.transform = 'scale(1) rotate(0deg)';
                panel.style.opacity = '1';
                header.style.cursor = 'grab';

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                physicsLoop();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
        return;
    }

    // Блок синхронизации с setInterval (чтобы не прыгало)
    if (panel.dataset.posX && panel.dataset.posY) {
        panel.style.left = panel.dataset.posX + 'px';
        panel.style.top = panel.dataset.posY + 'px';
        panel.style.right = 'auto';
    }

    panel.style.display = 'flex';
    const list = panel.querySelector('.draft-list');
    const relevantDrafts = hwork_drafts[currentHwId] || [];
    const currentData = JSON.stringify(relevantDrafts);

    if (list.getAttribute('data-last') === currentData) return;
    list.setAttribute('data-last', currentData);

    if (relevantDrafts.length === 0) {
        list.innerHTML = '<div style="padding:15px;font-size:11px;color:#555;text-align:center">Черновиков нет</div>';
        return;
    }

    list.innerHTML = '';
    relevantDrafts.forEach(draft => {
        const el = document.createElement('div');
        el.className = 'draft-item';
        el.innerHTML = `<div>Черновик ${draft.time}</div><small><span class="ans-glow">${draft.count} отв.</span></small>`;
        el.onclick = () => restoreHworkDraft(draft);
        list.appendChild(el);
    });
}

    // Запускаем при загрузке и при кликах на кнопки
    setTimeout(centerActiveTask, 500);
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('Hlt15') || e.target.closest('.nEjyO')) {
            setTimeout(centerActiveTask, 50);
        }
    });

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

        try {
            if (settings.videoResizer) {
                initVideoResizer();
            }
            updateChatControl();
        } catch (err) {
            console.error("Ошибка в цикле скрипта:", err);
        }

        updatePointsUI();
        updateDraftsUI();
        applyCleanMode();

        // ЖЕСТКАЯ ПРОВЕРКА ВИДИМОСТИ
        if (settings.showHwCount === false) {
            document.querySelectorAll('.custom-hw-count').forEach(el => {
                if (el.style.display !== 'none') el.style.display = 'none';
            });
        }


        // --- ЛОГИКА УДАЛЕНИЯ ВКЛАДОК ---
        const header = document.querySelector('.UVfvX');
        const tabs = document.querySelector('.TsqGd');

        if (header) {
            if (!tabsRemovalStartTime) {
                tabsRemovalStartTime = Date.now();
            }

            const elapsed = Date.now() - tabsRemovalStartTime;
            // Если прошло 2.5 сек и табы на месте
            if (elapsed > 2500 && tabs) {
                tabs.remove();
                console.log("[UI] Вкладки курса удалены");
            }
        }
        // ------------------------------

        const parentWrapper = document.querySelector('.wCNrd');
        const chatContainer = document.querySelector('.vqMgR');

        if (parentWrapper && chatContainer) {
            if (chatContainer.style.display !== 'none') {
                parentWrapper.style.display = 'flex';
                parentWrapper.style.flexDirection = 'row';
            }
        }

        // --- ВЫЗОВ ТАЙМЕРА ОДНОЙ СТРОКОЙ ---
        handlePersistentTimer();

        // --- АВТО-ЦЕНТРИРОВАНИЕ ---
        const currentActive = document.querySelector('.Hlt15.HqV_y');
        if (currentActive) {
            const currentId = currentActive.innerText;
            if (currentId !== lastActiveId) {
                lastActiveId = currentId;
                // Даем сайту 100мс отрисовать изменения и центрируем
                setTimeout(centerActiveTask, 100);
            }
        }

        initBannerToggle();
        initDownloadButtons();
        initGlobalDownload();
    }, 800);

function initWebGLBackground() {
    const canvasId = 'webgl-canvas';
    if (document.getElementById(canvasId)) return;

    // НАСТРОЙКА ПРОИЗВОДИТЕЛЬНОСТИ
    // 0.2 = рендерим всего 20% пикселей. Дым будет мягким, FPS взлетит.
    const QUALITY_RATIO = 0.25;

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;

    // Стили для растягивания и плавности
    Object.assign(canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: '-1',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 1.5s ease',
        // Размываем пиксели при растягивании, чтобы не было "квадратиков"
        filter: 'blur(15px)',
        transform: 'translateZ(0)' // Форсируем GPU композицию
    });
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
        alpha: false, // Отключаем прозрачность канваса для скорости
        antialias: false, // Выключаем сглаживание (не нужно для дыма)
        depth: false, // Выключаем буфер глубины
        preserveDrawingBuffer: false
    });

    if (!gl) return;

    // Простой вершинный шейдер
    const vertexSource = `
        attribute vec2 position;
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Оптимизированный фрагментный шейдер
    const fragmentSource = `
        precision mediump float; // Средняя точность (быстрее)
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;

        void main() {
            // Нормализация координат
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y;

            // Замедленное время для плавности
            float t = u_time * 0.15;

            // Координаты для искажения
            vec2 pos = st * 2.5;

            // УПРОЩЕННЫЙ ЦИКЛ (было 4 итерации, стало 3 - прирост 25%)
            for(float i = 1.0; i < 3.0; i++){
                pos.x += 0.5 / i * sin(i * pos.y + t + 0.3 * i) + 0.5;
                pos.y += 0.5 / i * cos(i * pos.x + t + 0.3 * i + 1.5);
            }

            // Твой цвет (#775AFA)
            vec3 colorBase = vec3(0.46, 0.35, 0.98);

            // Рисунок волн
            float pattern = sin(pos.x + pos.y);

            // Мягкое свечение (убрали тяжелый distance к мыши для фона)
            float glow = smoothstep(0.3, 0.8, pattern);

            // Добавляем легкую реакцию на мышь (оптимизированная)
            vec2 mouseNorm = u_mouse / u_resolution;
            float dist = distance(st, mouseNorm * vec2(u_resolution.x/u_resolution.y, 1.0));
            // Свечение только рядом с курсором
            glow += 0.2 / (dist * 10.0 + 0.5);

            // Смешиваем с черным фоном
            vec3 finalColor = mix(vec3(0.0), colorBase, glow * 0.5); // 0.5 - яркость

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    // Компиляция
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    // Геометрия (Квадрат на весь экран)
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse');

    // Переменные состояния
    let mouseX = 0, mouseY = 0;

    window.addEventListener('mousemove', (e) => {
        // Мышь тоже нормализуем под низкое разрешение
        mouseX = e.clientX * QUALITY_RATIO;
        mouseY = (window.innerHeight - e.clientY) * QUALITY_RATIO;
    }, {passive: true});

    function resize() {
        // Ставим внутреннее разрешение канваса меньше реального
        const displayWidth = window.innerWidth * QUALITY_RATIO;
        const displayHeight = window.innerHeight * QUALITY_RATIO;

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
    }

    let checkTimeout = null;

    function render(time) {
        const isDark = document.body.classList.contains('is-dark-mode');
        const isActive = settings && settings.useShaders;

        if (isDark && isActive) {
            // Убираем таймаут, если проснулись раньше 2 секунд
            if (checkTimeout) {
                clearTimeout(checkTimeout);
                checkTimeout = null;
            }

            canvas.style.opacity = '1';
            resize();

            gl.uniform1f(timeLoc, time * 0.001);
            gl.uniform2f(resLoc, canvas.width, canvas.height);
            gl.uniform2f(mouseLoc, mouseX, mouseY);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            requestAnimationFrame(render);
        } else {
            canvas.style.opacity = '0';

            if (checkTimeout) clearTimeout(checkTimeout);

            checkTimeout = setTimeout(() => {
                requestAnimationFrame(render);
            }, 2000);
        }
    }

    requestAnimationFrame(render);
}

    // ВЫЗОВИ ЭТО ОДИН РАЗ ПОСЛЕ ЗАГРУЗКИ
    initWebGLBackground();

    async function checkForUpdates() {
        // Автоматически берем версию из метаданных скрипта
        const currentVersion = GM_info.script.version;
        const rawUrl = 'https://raw.githubusercontent.com/neverbxrn/100points.pro/main/100Points%20Pro.js';

        // Ссылка для "автоматической" установки (Tampermonkey сам поймет, что это скрипт)
        const installUrl = 'https://neverbxrn.github.io/100points.pro/';

        console.log('[Update Check] Текущая версия:', currentVersion);

        try {
            const response = await fetch(rawUrl, { cache: "no-store" });
            if (!response.ok) return;

            const text = await response.text();
            // Регулярка теперь ищет именно твой формат: // @version  7.0
            const match = text.match(/\/\/ @version\s+([\d.]+)/);

            if (match && match[1]) {
                const latestVersion = match[1].trim();
                console.log(`[Update Check] На GitHub найдена версия: ${latestVersion}`);

                // Сравниваем версии как числа или строки
                if (parseFloat(latestVersion) > parseFloat(currentVersion)) {
                    console.log('[Update Check] Доступна новая версия!');
                    showUpdateNotify(latestVersion, installUrl);
                } else {
                    console.log('[Update Check] У вас актуальная версия.');
                }
            }
        } catch (e) {
            console.error('[Update Check] Ошибка:', e);
        }
    }

    function showUpdateNotify(newVersion, url) {
        if (document.getElementById('update-notification-toast')) return;

        const notify = document.createElement('div');
        notify.id = 'update-notification-toast';
        notify.style.cssText = `
        position: fixed !important;
        bottom: 100px !important;
        right: 30px !important;
        width: 300px !important;
        background: #1a1a1a !important;
        color: white !important;
        padding: 20px !important;
        border-radius: 16px !important;
        z-index: 999999 !important;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6) !important;
        font-family: 'Segoe UI', Roboto, sans-serif !important;
        border: 1px solid #775AFA !important;
        animation: slideInUpdate 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    `;

        notify.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <div style="background: #775AFA; padding: 8px; border-radius: 50%;">🚀</div>
            <div style="font-weight: bold; font-size: 16px;">Доступна v${newVersion}</div>
        </div>
        <div style="font-size: 13px; color: #ccc; margin-bottom: 18px; line-height: 1.4;">
            Нажми «Обновить», чтобы тебя перекинуло на страничку с обновлением.
        </div>
        <div style="display: flex; gap: 10px;">
            <a href="${url}" id="confirm-update" style="background: #775AFA; color: white; padding: 10px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; flex: 1; text-align: center; transition: 0.2s;">
                Обновиться
            </a>
            <button id="close-update-notify" style="background: #333; border: none; color: #aaa; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; flex: 0.5;">
                Не
            </button>
        </div>
    `;

        document.body.appendChild(notify);

        // Добавляем анимацию появления
        const style = document.createElement('style');
        style.innerHTML = `
        @keyframes slideInUpdate {
            from { transform: translateX(100%) opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
        document.head.appendChild(style);

        // При клике на "Обновить" мы просто закрываем уведомление и открываем ссылку.
        // Браузер/Tampermonkey сделает остальное.
        document.getElementById('confirm-update').onclick = () => {
            setTimeout(() => notify.remove(), 1000);
        };

        document.getElementById('close-update-notify').onclick = () => notify.remove();
    }

    // Запуск (лучше с задержкой в пару секунд, чтобы не тормозить загрузку страницы)
    setTimeout(checkForUpdates, 3000);

    // --- СЛУШАТЕЛЬ КЛИКОВ (для центрирования) ---
    // Этот блок ставится отдельно, один раз
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('Hlt15') || e.target.closest('.nEjyO')) {
            setTimeout(centerActiveTask, 50);
        }
    });

    // Разблокировка аудиоконтекста после первого клика пользователя
    const unlockAudio = () => {
        const silentCtx = new (window.AudioContext || window.webkitAudioContext)();
        silentCtx.resume().then(() => {
            console.log("🔈 Аудио разблокировано");
            document.removeEventListener('click', unlockAudio);
        });
    };
    document.addEventListener('click', unlockAudio);

    new MutationObserver(updateThemeClass).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('scroll', debouncedApplyLogic, {passive: true});
})();
