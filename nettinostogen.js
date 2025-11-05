'use strict';

(function(){
  const form = document.getElementById('ui-form');
  const urlInput = document.getElementById('uutisurl');
  const captureBtn = document.getElementById('capture');
  const imageSelector = document.getElementById('image-selector');
  const previewImage = document.getElementById('image');
  const imageFrame = document.querySelector('.image-frame');
  const chooseImageBtn = document.getElementById('chooseImage');
  const textsContainer = document.getElementById('texts');
  const headingEl = document.getElementById('heading');
  const tagEl = document.getElementById('tag');
  const previewArea = document.getElementById('element-to-capture');
  const option1900 = document.getElementById('nett-option-1900');
  const option2200 = document.getElementById('nett-option-2200');
  const optionSport1 = document.getElementById('nett-option-sport1');
  const optionSport2 = document.getElementById('nett-option-sport2');
  const optionHusu = document.getElementById('nett-option-husu');
  const scaleAll = document.getElementById('nett-scale-all');
  const scaleX = document.getElementById('nett-scale-x');
  const scaleY = document.getElementById('nett-scale-y');
  const fontScale = document.getElementById('nett-font-scale');
  const scaleAllValue = document.getElementById('nett-scale-all-value');
  const scaleXValue = document.getElementById('nett-scale-x-value');
  const scaleYValue = document.getElementById('nett-scale-y-value');
  const fontScaleValue = document.getElementById('nett-font-scale-value');
  const fontLockToggle = document.getElementById('nett-font-lock');
  const rangeInputs = [scaleAll, scaleX, scaleY, fontScale].filter(Boolean);

  let fontScaleMultiplier = 1;
  let currentScaleX = 1;
  let currentScaleY = 1;
  let imageOffsetX = 0;
  let imageOffsetY = 0;
  let dragPointerId = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let fontLockEnabled = Boolean(fontLockToggle?.checked);

  const BASE_FONT_SIZE = 30;
  const MAX_FONT_SIZE = 60;
  const MIN_FONT_SIZE = 12;

  function clamp(value, min, max){
    return Math.min(Math.max(value, min), max);
  }
  function updateRangeFill(el){
    if (!el) return;
    const min = Number(el.min ?? 0);
    const max = Number(el.max ?? 100);
    const value = Number(el.value ?? min);
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
    el.style.setProperty('--ng-range-value', `${clamp(percent, 0, 100)}%`);
  }

  if (!form || !urlInput || !captureBtn || !imageSelector || !previewImage || !textsContainer) {
    console.warn('NettinostoGen: pakollisia elementtejä puuttuu.');
    return;
  }

  function adjustFontSize(){
    const container = textsContainer;
    const textElement = headingEl;
    if (!container || !textElement) return;

    const multiplier = fontScaleMultiplier || 1;
    const preferredSize = Math.min(
      MAX_FONT_SIZE,
      Math.max(MIN_FONT_SIZE, Math.round(BASE_FONT_SIZE * multiplier))
    );

    if (fontLockEnabled){
      let fontSize = preferredSize;
      textElement.style.fontSize = fontSize + 'px';

      while (
        (textElement.scrollWidth > container.clientWidth ||
          textElement.scrollHeight > container.clientHeight) &&
        fontSize > MIN_FONT_SIZE
      ){
        fontSize -= 1;
        textElement.style.fontSize = fontSize + 'px';
      }
      return;
    }

    const maxAllowed = preferredSize;
    let fontSize = MIN_FONT_SIZE;
    textElement.style.fontSize = fontSize + 'px';

    while (
      textElement.scrollWidth <= container.clientWidth &&
      textElement.scrollHeight <= container.clientHeight &&
      fontSize < maxAllowed
    ){
      fontSize += 1;
      textElement.style.fontSize = fontSize + 'px';
    }

    while (
      (textElement.scrollWidth > container.clientWidth ||
        textElement.scrollHeight > container.clientHeight) &&
      fontSize > MIN_FONT_SIZE
    ){
      fontSize -= 1;
      textElement.style.fontSize = fontSize + 'px';
    }
  }

  function applyImageTransform(){
    if (!previewImage) return;
    const scaleX = currentScaleX || 1;
    const scaleY = currentScaleY || 1;
    const translateX = scaleX ? imageOffsetX / scaleX : imageOffsetX;
    const translateY = scaleY ? imageOffsetY / scaleY : imageOffsetY;
    previewImage.style.transform =
      `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
  }

  function resetImagePosition(){
    imageOffsetX = 0;
    imageOffsetY = 0;
    applyImageTransform();
  }

  function beginDrag(event){
    if (!previewImage) return;
    if (event.button !== undefined && event.button !== 0) return;
    isDragging = true;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    startOffsetX = imageOffsetX;
    startOffsetY = imageOffsetY;
    imageFrame?.classList.add('dragging');
    previewImage.setPointerCapture?.(dragPointerId);
    event.preventDefault();
  }

  function dragMove(event){
    if (!isDragging || event.pointerId !== dragPointerId) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    imageOffsetX = startOffsetX + dx;
    imageOffsetY = startOffsetY + dy;
    applyImageTransform();
  }

  function endDrag(event){
    if (!isDragging || event.pointerId !== dragPointerId) return;
    isDragging = false;
    imageFrame?.classList.remove('dragging');
    if (previewImage.hasPointerCapture?.(dragPointerId)){
      previewImage.releasePointerCapture(dragPointerId);
    }
    dragPointerId = null;
  }

  function updateScaleControls(triggerAdjust = true){
    const uniform = Number(scaleAll?.value || 100);
    const horizontal = Number(scaleX?.value || 100);
    const vertical = Number(scaleY?.value || 100);
    const font = Number(fontScale?.value || 100);

    rangeInputs.forEach(updateRangeFill);

    if (scaleAllValue){
      scaleAllValue.textContent = `${uniform}%`;
    }
    if (scaleXValue){
      scaleXValue.textContent = `${horizontal}%`;
    }
    if (scaleYValue){
      scaleYValue.textContent = `${vertical}%`;
    }
    if (fontScaleValue){
      fontScaleValue.textContent = `${font}%`;
    }

    const baseScale = uniform / 100;
    const scaleFactorX = baseScale * (horizontal / 100);
    const scaleFactorY = baseScale * (vertical / 100);

    currentScaleX = scaleFactorX || 1;
    currentScaleY = scaleFactorY || 1;

    if (previewArea){
      previewArea.style.transform = '';
    }
    if (previewImage){
      previewImage.style.transformOrigin = 'center bottom';
    }
    applyImageTransform();

    fontScaleMultiplier = font / 100;
    if (tagEl){
      tagEl.style.fontSize = '';
    }

    if (triggerAdjust){
      adjustFontSize();
    }
  }

  function parseNewsUrl(str){
    if (!str) return null;
    const trimmed = str.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http')){
      try{
        const newsUrl = new URL(trimmed);
        const parts = newsUrl.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || null;
      }catch(err){
        return null;
      }
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  async function fetchNewsInfo(str){
    const newsId = parseNewsUrl(str);
    if (!newsId){
      alert('Virheellinen syöte. Anna uutisen URL tai numeerinen ID.');
      return;
    }

    try{
      const res = await fetch(`https://api.mtvuutiset.fi/graphql/caas/v1/tvNewsArticle/${newsId}`);
      if (!res.ok){
        throw new Error(`Palvelin vastasi koodilla ${res.status}`);
      }

      const data = await res.json();
      const article = data?.article;
      if (!article){
        throw new Error('Odottamaton vastausrakenne');
      }

      headingEl.textContent = article.teaserTitle || 'Otsikko puuttuu';
      tagEl.textContent = article.teaserTopic?.title || 'Tagi puuttuu';

      const imgSrc =
        article.teaserPicture?.crops?.landscape16_9?.hdPlus ||
        article.teaserPicture?.url ||
        '';
      if (imgSrc && previewImage){
        previewImage.src = imgSrc;
        resetImagePosition();
      }

      adjustFontSize();
    }catch(err){
      console.error('Virhe haettaessa uutista:', err);
      alert('Uutisen tietojen hakeminen epäonnistui. Tarkista syöte ja yritä uudelleen.');
    }
  }

  function getDownloadSuffix(){
    if (option1900?.checked) return '-1900-nettinosto-jumbolla1';
    if (option2200?.checked) return '-2200-nettinosto-jumbolla1';
    if (optionSport1?.checked) return '-sport1-nettinosto-jumbolla1';
    if (optionSport2?.checked) return '-sport2-nettinosto-jumbolla1';
    if (optionHusu?.checked) return '-husu-nettinosto-jumbolla1';
    return '-nettinosto-jumbolla1';
  }

  function formatDateForFilename(){
    const now = new Date();
    const day = String(now.getDate()).padStart(2,'0');
    const month = String(now.getMonth() + 1).padStart(2,'0');
    const suffix = getDownloadSuffix();
    return `${day}${month}${suffix}.png`;
  }

  function handleFileSelect(evt){
    const file = evt.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string' && previewImage){
        previewImage.src = e.target.result;
        resetImagePosition();
      }
    };
    reader.readAsDataURL(file);
  }

  captureBtn.addEventListener('click', () => {
    const element = previewArea;
    if (!element){
      console.error('Element-to-capture puuttuu.');
      return;
    }

    const rect = element.getBoundingClientRect();
    html2canvas(element, {
      allowTaint:true,
      useCORS:true,
      backgroundColor:null,
      scale:4,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }).then(canvas => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = formatDateForFilename();
      link.click();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    fetchNewsInfo(urlInput?.value || '');
  });

  imageSelector.addEventListener('change', handleFileSelect);
  if (chooseImageBtn){
    chooseImageBtn.addEventListener('click', () => imageSelector.click());
  }
  if (previewImage){
    previewImage.addEventListener('pointerdown', beginDrag);
    previewImage.addEventListener('pointermove', dragMove);
    previewImage.addEventListener('pointerup', endDrag);
    previewImage.addEventListener('pointercancel', endDrag);
    previewImage.addEventListener('lostpointercapture', () => {
      isDragging = false;
      dragPointerId = null;
      imageFrame?.classList.remove('dragging');
    });
  }

  [scaleAll, scaleX, scaleY].forEach(input => {
    input?.addEventListener('input', () => updateScaleControls(true));
  });
  fontScale?.addEventListener('input', () => updateScaleControls(true));
  fontLockToggle?.addEventListener('change', (evt) => {
    fontLockEnabled = Boolean(evt.target?.checked);
    adjustFontSize();
  });

  textsContainer.addEventListener('input', adjustFontSize);

  updateScaleControls(false);
  adjustFontSize();
})();
