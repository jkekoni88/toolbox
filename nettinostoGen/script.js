async function fetchTopArticlesAndGenerateImage() {
  try {
    console.log("Fetching top articles...");
    const response = await fetch(
      "https://api.mtvuutiset.fi/graphql/caas/v1/topArticlesTicker?q=lastMinute&limit=10"
    );
    const data = await response.json();
    console.log("Fetched data:", data);

    // Hae neljän ensimmäisen artikkelin otsikot
    const articles = data.data.topArticles.items || [];
    const topArticles = articles.slice(0, 4);

    if (topArticles.length === 0) {
      throw new Error("No articles found");
    }

    // Luo HTML sisältö
    const container = document.getElementById("articles-container");
    container.innerHTML = ""; // Tyhjennä vanhat artikkelit

    topArticles.forEach((article, index) => {
      const articleElement = document.createElement("p");
      articleElement.textContent = `${index + 1}. ${article.title}`;
      articleElement.style.margin = "10px 0";
      articleElement.style.fontSize = "16px";
      container.appendChild(articleElement);
    });

    // Generoi kuva
    generateImageFromArticles();
  } catch (error) {
    console.error("Virhe haettaessa artikkeleita:", error);
  }
}

function generateImageFromArticles() {
  const container = document.getElementById("articles-container");
  html2canvas(container).then((canvas) => {
    // Lisää luotu kuva sivulle
    const imageContainer = document.getElementById("generated-image-container");
    imageContainer.innerHTML = ""; // Tyhjennä vanhat kuvat
    imageContainer.appendChild(canvas);
  });
}

// Lisää tapahtumankuuntelija napille
document
  .getElementById("generate-button")
  .addEventListener("click", fetchTopArticlesAndGenerateImage);
