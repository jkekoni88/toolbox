'use strict';

(function(){
  const els = {
    apiStatus: document.getElementById('api-status'),
    articlesContainer: document.getElementById('articles-container'),
    generateBtn: document.getElementById('generate-button'),
    sportsBtn: document.getElementById('fetch-sports-button'),
    updateBtn: document.getElementById('update-button'),
    downloadBtn: document.getElementById('download-button'),
    check1900: document.getElementById('option-1900'),
    check2200: document.getElementById('option-2200'),
    checkSport1: document.getElementById('option-sport1'),
    checkSport2: document.getElementById('option-sport2'),
    checkHusu: document.getElementById('option-husu'),
  };

  if (!els.articlesContainer || !els.generateBtn || !els.updateBtn || !els.downloadBtn){
    console.warn('LuetuimmatGen: pakollisia elementteja puuttuu.');
    return;
  }

  els.articlesBody = els.articlesContainer.querySelector('.body');
  const footerEl = els.articlesContainer.querySelector('.footer');

  let textChanged = false;
  let lastBlob = null;

  const statusWrapper = (() => {
    const parent = els.apiStatus?.parentElement;
    if (!parent) return null;
    if (parent.classList.contains('badge') || parent.classList.contains('api-status-pill')){
      return parent;
    }
    return null;
  })();

  function setApiStatus(ok){
    if (!els.apiStatus) return;
    els.apiStatus.textContent = ok ? 'API toimii!' : 'API ei ole saavutettavissa!';
    const target = statusWrapper || els.apiStatus;
    target.classList.toggle('ok', ok);
    target.classList.toggle('fail', !ok);
  }

  async function checkApiStatus(){
    try{
      const res = await fetch('https://api.mtvuutiset.fi/graphql/caas/v1/topArticlesTicker?q=today&limit=1');
      setApiStatus(res.ok);
    }catch(err){
      console.error('API-testi epaonnistui:', err);
      setApiStatus(false);
    }
  }

  function buildArticleRow(text, index){
    const p = document.createElement('p');
    p.textContent = text;
    p.setAttribute('data-index', String(index));
    p.contentEditable = 'true';
    p.spellcheck = false;
    p.addEventListener('input', markTextChanged);
    return p;
  }

  function buildSeparator(){
    return document.createElement('hr');
  }

  function renderArticles(articles){
    els.articlesBody.innerHTML = '';
    articles.forEach((title, idx) => {
      els.articlesBody.appendChild(buildArticleRow(title, idx + 1));
      if (idx < articles.length - 1){
        els.articlesBody.appendChild(buildSeparator());
      }
    });
    markTextChanged();
  }

  function highlightUpdateButton(active){
    els.updateBtn.classList.toggle('needs-update', active);
  }

  function setDownloadState(enabled){
    els.downloadBtn.disabled = !enabled;
    els.downloadBtn.classList.toggle('btn-disabled', !enabled);
    els.downloadBtn.classList.toggle('ready', enabled);
    if (!enabled){
      lastBlob = null;
    }
  }

  function markTextChanged(){
    textChanged = true;
    highlightUpdateButton(true);
    setDownloadState(false);
  }

  function ensureFooter(){
    if (!footerEl.textContent?.trim()){
      footerEl.textContent = 'LUE LIS\u00C4\u00C4: mtvuutiset.fi tai lataa sovellus';
    }
  }

  async function generateImageFromArticles(){
    const target = els.articlesContainer;
    const rendered = await html2canvas(target, {
      width: target.clientWidth,
      height: target.clientHeight,
      backgroundColor: '#ffffff',
      scale: 4,
    });

    return new Promise(resolve => {
      rendered.toBlob(blob => {
        if (blob){
          lastBlob = blob;
          setDownloadState(true);
          highlightUpdateButton(false);
          textChanged = false;
        }else{
          setDownloadState(false);
          highlightUpdateButton(true);
        }
        resolve();
      }, 'image/png', 1.0);
    });
  }

  function normaliseArticleTitle(article){
    return article?.title || 'Otsikko puuttuu';
  }

  async function fetchArticles(query, limit = 10){
    const url = `https://api.mtvuutiset.fi/graphql/caas/v1/topArticlesTicker?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok){
      throw new Error(`Palvelin vastasi koodilla ${res.status}`);
    }
    const data = await res.json();
    return data?.topArticles?.items || data?.data?.topArticles?.items || [];
  }

  async function generateNews(){
    try{
      const items = await fetchArticles('today_uutiset', 10);
      const top = items.slice(0, 4).map(normaliseArticleTitle);
      if (!top.length){
        throw new Error('Artikkeleita ei loytynyt');
      }
      renderArticles(top);
      ensureFooter();
      await generateImageFromArticles();
    }catch(err){
      console.error('Virhe haettaessa uutisia:', err);
      alert('Luetuimpien hakeminen epaonnistui. Yrita uudelleen myohemmin.');
    }
  }

  async function generateSports(){
    try{
      const items = await fetchArticles('today', 40);
      const sports = items.filter(article => article?.category === 'urheilu').slice(0, 4).map(normaliseArticleTitle);
      if (!sports.length){
        throw new Error('Urheiluartikkeleita ei loytynyt');
      }
      renderArticles(sports);
      ensureFooter();
      await generateImageFromArticles();
    }catch(err){
      console.error('Virhe haettaessa urheilu-uutisia:', err);
      alert('Sport-listan hakeminen epaonnistui. Yrita uudelleen.');
    }
  }

  function getSuffix(){
    if (els.check1900.checked) return '-1900-nettinosto-jumbolla2';
    if (els.check2200.checked) return '-2200-nettinosto-jumbolla2';
    if (els.checkSport1.checked) return '-sport1-nettinosto-jumbolla2';
    if (els.checkSport2.checked) return '-sport2-nettinosto-jumbolla2';
    if (els.checkHusu.checked) return '-husu';
    return '-uutiset-nettinosto-jumbolla2';
  }

  function downloadCanvas(){
    if (!lastBlob){
      return;
    }
    const now = new Date();
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const suffix = getSuffix();
    const fileName = `${date}${month}${suffix}.png`;

    const url = URL.createObjectURL(lastBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpdate(){
    if (textChanged){
      await generateImageFromArticles();
    }
  }

  function attachArticleListeners(){
    els.articlesBody.addEventListener('input', markTextChanged);
    if (footerEl){
      footerEl.addEventListener('input', markTextChanged);
    }
  }

  checkApiStatus();
  setDownloadState(false);
  attachArticleListeners();
  generateImageFromArticles();

  els.generateBtn.addEventListener('click', generateNews);
  els.sportsBtn.addEventListener('click', generateSports);
  els.updateBtn.addEventListener('click', handleUpdate);
  els.downloadBtn.addEventListener('click', downloadCanvas);
})();
