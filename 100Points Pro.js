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
