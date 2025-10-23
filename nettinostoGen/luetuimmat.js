async function fetchTopArticles() {
  try {
    const response = await fetch(
      "https://api.mtvuutiset.fi/graphql/caas/v1/topArticlesTicker?q=today&limit=10"
    );
    if (!response.ok) throw new Error("API-pyyntö epäonnistui");
    const data = await response.json();

    const topArticles = data.data.articles.map((article) => ({
      title: article.title,
      image: article.image ? article.image.url : "",
    }));

    updateUIWithArticles(topArticles.slice(0, 4)); // Näytetään vain neljä artikkelia
  } catch (error) {
    console.error("Virhe haettaessa artikkeleita:", error);
  }
}

function updateUIWithArticles(articles) {
  const container = document.getElementById("element-to-capture");
  container.innerHTML = ""; // Tyhjennetään vanhat sisällöt

  articles.forEach((article) => {
    const articleDiv = document.createElement("div");
    articleDiv.classList.add("article");

    const img = document.createElement("img");
    img.classList.add("image");
    img.src =
      article.image ||
      "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="; // Placeholder
    articleDiv.appendChild(img);

    const divider = document.createElement("div");
    divider.classList.add("divider");
    articleDiv.appendChild(divider);

    const title = document.createElement("h1");
    title.textContent = article.title;
    articleDiv.appendChild(title);

    container.appendChild(articleDiv);
  });
}

document
  .getElementById("generate-top-articles")
  .addEventListener("click", fetchTopArticles);
