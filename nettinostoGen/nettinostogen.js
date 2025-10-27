'use strict';

(function(){
  const form = document.getElementById('ui-form');
  const urlInput = document.getElementById('uutisurl');
  const captureBtn = document.getElementById('capture');
  const imageSelector = document.getElementById('image-selector');
  const previewImage = document.getElementById('image');
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

  let fontScaleMultiplier = 1;

  if (!form || !urlInput || !captureBtn || !imageSelector || !previewImage || !textsContainer) {
    console.warn('NettinostoGen: pakollisia elementtejä puuttuu.');
    return;
  }

  function adjustFontSize(){
    const container = textsContainer;
    const textElement = headingEl;
    if (!container || !textElement) return;

    let fontSize = 30;

    const applySize = (size) => {
      textElement.style.fontSize = (size * fontScaleMultiplier) + 'px';
    };

    applySize(fontSize);

    while (
      textElement.scrollWidth <= container.clientWidth &&
      textElement.scrollHeight <= container.clientHeight &&
      fontSize < 60
    ){
      fontSize += 1;
      applySize(fontSize);
    }

    while (
      textElement.scrollWidth > container.clientWidth ||
      textElement.scrollHeight > container.clientHeight
    ){
      fontSize -= 1;
      if (fontSize < 12) break;
      applySize(fontSize);
    }
  }

  function updateScaleControls(triggerAdjust = true){
    const uniform = Number(scaleAll?.value || 100);
    const horizontal = Number(scaleX?.value || 100);
    const vertical = Number(scaleY?.value || 100);
    const font = Number(fontScale?.value || 100);

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

    if (previewArea){
      previewArea.style.transform = '';
    }
    if (previewImage){
      previewImage.style.transformOrigin = 'center center';
      previewImage.style.transform = `scale(${scaleFactorX}, ${scaleFactorY})`;
    }

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
      if (imgSrc){
        previewImage.src = imgSrc;
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
      if (typeof e.target?.result === 'string'){
        previewImage.src = e.target.result;
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
  previewImage.addEventListener('click', () => imageSelector.click());
  if (chooseImageBtn){
    chooseImageBtn.addEventListener('click', () => imageSelector.click());
  }

  [scaleAll, scaleX, scaleY].forEach(input => {
    input?.addEventListener('input', () => updateScaleControls(true));
  });
  fontScale?.addEventListener('input', () => updateScaleControls(true));

  textsContainer.addEventListener('input', adjustFontSize);

  updateScaleControls(false);
  adjustFontSize();
})();
