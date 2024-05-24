document.addEventListener("DOMContentLoaded", () => {
    // Fetcha alla filmer från databasen
    fetch("http://localhost:4000/movies")
        // Konvertera till JSON
        .then(response => response.json())
        .then(data => {
            // Hämta filmid från URL
            const params = new URLSearchParams(window.location.search);

            const filmid = params.get("film_id");
            // Hitta filmen med det specifika filmid
            const film = data.movies.find(m => m.filmID === parseInt(filmid)); //parseInt för att jämföra det som integer

            // Om filmen hittas, ändra innehållet på sidan
            if (film) {
                document.getElementById("title").textContent = film.title; //ändrar titeln på filmen
                document.getElementById("director").textContent = "Directed by " + film.director //ändrar regissören på filmen
                document.getElementById("year").textContent = "(" + film.year + ")"; //ändrar året på filmen
                //Gömmer element om det saknar tagline
                //Detta är pga det inte alltid finns en tagline
                if (film.tagline === "-") {
                    document.getElementById("tagline").style.display = "none"
                } else {
                    document.getElementById("tagline").textContent = film.tagline; //ändrar tagline på filmen
                }
                document.getElementById("description").textContent = film.description; //ändrar beskrivningen på filmen
                document.getElementById("poster").src = film.poster; //ändrar poster på filmen
            } else {
                console.error("Movie not found");
            }
        })
        .catch(error => {
            console.error("Error fetching movie:", error);
        });
});
